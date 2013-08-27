#!/usr/bin/perl

use strict;
use IO::Socket;
use JSON::XS;
use MIME::Base64;
use DBI;
use File::stat;
use File::Spec::Functions;
use Cwd;
use GraphViz;
use URI;
use Time::HiRes qw(gettimeofday tv_interval);
use CGI qw(:standard);
use Data::GUID::Any 'guid_as_string';
use Fireshark;
use HTML::Tidy;
use URI::Escape;

my @user_agents = ( { name         => 'Internet Explorer 6, Windows XP',
		   value	=> 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; .NET CLR 1.1.4322)' },
                 { name		=> 'Internet Explorer 7, Windows XP',
		   value	=> 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; .NET CLR 1.1.4322; .NET CLR 2.0.50727; .NET CLR 3.0.04506.30)' },
                 { name		=> 'Internet Explorer 7, Windows Vista',
		   value	=> 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1)' },
                 { name         => 'Firefox 2.0, Windows XP',
                   value       => 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-GB; rv:1.8.1.6) Gecko/20070725 Firefox/2.0.0.6' },
                 { name         => 'Safari, Mac OS X 10.6.5',
                   value       => 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_5; ar) AppleWebKit/533.19.4 (KHTML, like Gecko) Version/5.0.3 Safari/533.19.4' } );

my @proxies = (  { name        => 'No Proxy',
                   value       => '' } );

my $g_level = uri_unescape(param('l')) || '';
my $g_url = uri_unescape(param('url')) || '';
my $g_referrer = uri_unescape(param('referrer')) || '';
my $g_ua = uri_unescape(param('ua')) || '';
my $g_proxy = uri_unescape(param('proxy')) || '';
my $g_guid = uri_unescape(param('guid')) || '';
my $g_terms = uri_unescape(param('terms')) || '';

print "Content-type: text/html; charset=iso-8859-1\n\n";

if($g_level eq "1") {

    my $json = JSON::XS->new;
    my $jsonobj = {};
    my $jsonstr;

    if(length($g_url) == 0) {
        $jsonobj->{error} = 1;
        $jsonobj->{error_message} = "URL field is required";

    } elsif($g_terms eq "off") {
        $jsonobj->{error} = 1;
        $jsonobj->{error_message} = "Agreeing to the Terms of Use is required";
    } else {
        get_id_for_request($jsonobj, $g_url, $g_referrer, $g_ua, $g_proxy);
    }

    eval { $jsonstr = $json->encode($jsonobj); };
    if($@) {
        $jsonobj->{data} = "";
        $jsonobj->{error} = 1;
        $jsonobj->{error_message} = "Error during json encoding: " . $!;
        eval { $jsonstr = $json->encode($jsonobj); };
        print $jsonstr;
        return;
    } 

    print $jsonstr;

} elsif($g_guid ne '' && $g_level eq "2") {

    my $json = JSON::XS->new;
    my $jsonobj = {};
    my $jsonstr;

    $jsonobj->{error} = 0;
        
    get_json_data($jsonobj, $g_guid);

    eval { $jsonstr = $json->encode($jsonobj); };
    if($@) {
        $jsonobj->{data} = "";
        $jsonobj->{error} = 1;
        $jsonobj->{error_message} = "Error during json encoding: " . $!;
        eval { $jsonstr = $json->encode($jsonobj); };
        print $jsonstr;
        return;
    } 

    print $jsonstr;

} else {

    print_default($g_url);
}

sub get_json_data {

    my ($jsonobj, $guid) = @_;

    my ($dbh, $query, $query_handle);

    my $jsonstr;
    my $events;
    my $json = JSON::XS->new;

    my $g_iframes = {};
    my $summary;

    # PERL DBI CONNECT
    $dbh = DBI->connect("DBI:mysql:fireshark","webdev","suck*database");
    if($!) {
        $jsonobj->{error} = 1;
        $jsonobj->{data} .= "<p>Error connecting to database error: " . $DBI::errstr . "</p>";
        $jsonobj->{error_message} .= "<p>Error connecting to database error: " . $DBI::errstr . "</p>";
        return;
    }

    # PREPARE THE QUERY
    $query = "SELECT events, msduration, url, keyword, params, INET_NTOA(ipaddr) FROM fsevents WHERE fsevents_id = ?";

    $query_handle = $dbh->prepare($query);
    if($!) {
        $jsonobj->{error} = 1;
        $jsonobj->{data} .= "<p>Error creating prepare database statement error: " . $DBI::errstr . "</p>";
        $jsonobj->{error_message} .= "<p>Error creating prepare database statement error: " . $DBI::errstr . "</p>";
        return;
    }

    $query_handle->bind_param(1, $guid); 
    if($!) {
        $jsonobj->{error} = 1;
        $jsonobj->{data} .= "<p>Error binding parameters error: " . $DBI::errstr . "</p>";
        $jsonobj->{error_message} .= "<p>Error binding parameters error: " . $DBI::errstr . "</p>";
        return;
    }

    # EXECUTE THE QUERY
    $query_handle->execute();
    if($!) {
        $jsonobj->{error} = 1;
        $jsonobj->{data} .= "<p>Error executing statement error: " . $DBI::errstr . "</p>";
        $jsonobj->{error_message} .= "<p>Error executing statement error: " . $DBI::errstr . "</p>";
        return;
    }

    # BIND TABLE COLUMNS TO VARIABLES
    my ($e, $msduration, $url, $keyword, $params, $ipaddr);
    $query_handle->bind_columns(\$e, \$msduration, \$url, \$keyword, \$params, \$ipaddr);

    # LOOP THROUGH RESULTS
    my $url_decoded = "";
    while($query_handle->fetch()) {
        $jsonstr = decode_base64($e);
        $url_decoded = decode_base64($url);
    } 

    $jsonobj->{data} .= "<p>URL: " . $url_decoded . "</p>";
    #$jsonobj->{data} .= "<p>IP: " . $ipaddr . "</p>";
    #$jsonobj->{data} .= "<p>Permalink: <a href=\"http://" . $ENV{SERVER_NAME} . $ENV{SCRIPT_NAME} . "?id=" . $guid . "\">http://" . $ENV{SERVER_NAME} . $ENV{SCRIPT_NAME} . "?id=" . $guid . "</a><br\><br\></p>";
    $jsonobj->{data} .= "<p>Permalink: <a href=\"http://" . $ENV{SERVER_NAME} . "/fs" . "?id=" . $guid . "\">http://" . $ENV{SERVER_NAME} . "/fs" . "?id=" . $guid . "</a><br\><br\></p>";

    eval { $events = $json->decode($jsonstr); };
    if($@) {
        $jsonobj->{data} = "";
        $jsonobj->{error} = 1;
        $jsonobj->{error_message} = "Error during json encoding of session file: " . $!;
        print STDERR "error decoding json string of session file: $!\n";
        return;
    } 

    foreach my $event (@{$events}) {

        if(defined $event->{eventType} && $event->{eventType} eq "contentloaded") {
            showScreenshot($jsonobj, $guid, $event);

    	    $jsonobj->{data} .= "<p class=\"heading\">Content</p>";
            $jsonobj->{data} .= "<div class=\"content\">";
            buildChildTree($jsonobj, $g_iframes, $event->{doms});
            $jsonobj->{data} .= "</div>";
        }
    }

    showRedirectionChain($jsonobj, $g_iframes, $guid, $events);
    showNetworkConnections($jsonobj, $g_iframes, \$summary, $events);

    #if($ENV{'REMOTE_ADDR'} == "98.155.80.60") {
        showRawEvents($jsonobj, $events);
    #}

    if($ENV{'REMOTE_ADDR'} == "98.155.80.60") {
        #showURLVoid($jsonobj, $url_decoded);
    }

    #if($summary eq "") { $summary = "No suspicious events<br /><br />"; }
    #$jsonobj->{data} .= "<p class=\"heading\">Suspicious Summary</p>";
    #$jsonobj->{data} .= "<div class=\"content\">";
    #$jsonobj->{data} .= "<p class=\"summaryitem\">" . $summary . "</p>";
    #$jsonobj->{data} .= "</div>";
}

# get name from lookup hash returned from catengine
sub get_category_name {

    my ($lookup) = @_;

    my $name = "";

    return $name;
}

# category lookup using catengine
sub category_lookup {

    my ($url) = @_;

    return (0, 0, {});
}

sub get_file_contents {

    my $filepath = shift @_;
    my $escaped = shift @_;

    my $offset = 0;
    open FILE, "$filepath" or die print $!;
    binmode FILE;
    my ($buf, $data, $n);
    while(($n = read FILE, $data, 4) != 0) {
        $buf .= $data;
        $offset += $n;
    }
    close FILE;

    if(length($buf) > 0) {
        my $tidy = HTML::Tidy->new({
            tidy_mark => 0,
            indent => 1,
            doctype => "omit"
        });

        $tidy->ignore( type => 1, type => 2 );

        $buf = $tidy->clean($buf);
    }

    if($escaped == 1) {

        #$buf =~ s/[^a-zA-Z]//g;

        $buf =~ s/&/&amp/g;
        $buf =~ s/</&lt;/g;
        $buf =~ s/>/&gt;/g;
        #$buf =~ s/[\000-\037]//g;
        #$buf =~ s/[\x80-\xFF]//g;
        $buf =~ s/document\.write/<span style="background-color: #FFFF00">document.write<\/span>/g;
        $buf =~ s/jar/<span style="background-color: #FFFF00">jar<\/span>/g;
        $buf =~ s/iframe/<span style="background-color: #FFFF00">iframe<\/span>/ig;
        $buf =~ s/\.exe/<span style="background-color: #FFFF00">.exe<\/span>/g;
        $buf =~ s/String\.fromCharCode/<span style="background-color: #FFFF00">String.fromCharCode<\/span>/ig;
    }

    return $buf;
}

sub get_url_info {

    my ($url, $keyword, $elapsed, $params, $jsonstr) = @_;

    my ($dbh, $query, $query_handle);

    my $url_encoded = encode_base64($url);
    my $params_encoded = encode_base64($params);
    my $jsonstr_encoded = encode_base64($jsonstr);

    # PERL DBI CONNECT
    $dbh = DBI->connect("DBI:mysql:fireshark","webdev","suck*database")
        or die "Cannot connect to database at this time: $DBI::errstr\n";


    # PREPARE THE QUERY
    $query = "INSERT INTO fsevents (events, msduration, url, keyword, params) VALUES ('".$jsonstr_encoded."', '".$elapsed."', '".$url_encoded."', '".$keyword."', '".$params_encoded."', INET_ATON('".$ENV{'REMOTE_ADDR'}."'))";

    $query_handle = $dbh->prepare($query)
        or die "prepare failed: $DBI::err=$DBI::errstr\n";

    # EXECUTE THE QUERY
    $query_handle->execute()
        or die "execute failed: $DBI::err=$DBI::errstr\n";

    my $in_id = $dbh->{ q{mysql_insertid}};
    return $in_id;
}

sub insert_url_info {

    my ($url, $keyword, $elapsed, $params, $jsonstr) = @_;

    my ($dbh, $query, $query_handle);

    my $url_encoded = encode_base64($url);
    my $params_encoded = encode_base64($params);
    my $jsonstr_encoded = encode_base64($jsonstr);

    # PERL DBI CONNECT
    $dbh = DBI->connect("DBI:mysql:fireshark","webdev","suck*database")
        or die "Cannot connect to database at this time: $DBI::errstr\n";


    # PREPARE THE QUERY
    $query = "INSERT INTO fsevents (events, msduration, url, keyword, params, ipaddr) VALUES ('".$jsonstr_encoded."', '".$elapsed."', '".$url_encoded."', '".$keyword."', '".$params_encoded."', INET_ATON('".$ENV{'REMOTE_ADDR'}."'))";

    $query_handle = $dbh->prepare($query)
        or die "prepare failed: $DBI::err=$DBI::errstr\n";

    # EXECUTE THE QUERY
    $query_handle->execute()
        or die "execute failed: $DBI::err=$DBI::errstr\n";

    my $in_id = $dbh->{ q{mysql_insertid}};
    return $in_id;
}

sub get_id_for_request {

    my ($jsonobj, $url, $referrer, $ua, $proxy) = @_;

    my $json = JSON::XS->new;
    my $guid = guid_as_string();
    my $jsonstr = "";

    my ($elapsed, $params, $events) = analyze_via_fireshark($url, $referrer, $ua, $proxy);

    eval { $jsonstr = $json->encode($events); };
    if($@) {
        $jsonobj->{error} = 1;
        $jsonobj->{error_message} = "error decoding json output from fireshark: $!";
    }

    $guid = insert_url_info($url, "Fireshark Web", $elapsed, $params, $jsonstr);

    $jsonobj->{data} = $guid;
}

sub check_guid {

    my ($guid) = @_;

    $guid =~ s/[^a-zA-Z0-9]*//g;

    my $fname = "events/" . $guid;

    if (-e $fname) {
        print "1";
    } else {
        print "0";
    } 
}

sub print_default {

    my ($url) = @_;

print <<END;

<html> 
 
<head> 
<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1"> 
<title>Fireshark</title> 
<meta name="description" content="Analysis of malicious web pages"> 
<meta name="keywords" content="security, website analysis, research"> 
<link rel="StyleSheet" href="/css/fireshark.css" type="text/css" /> 
<link rel="StyleSheet" href="/css/prettify.css" type="text/css" /> 
<script type="text/javascript">

  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-26332579-1']);
  _gaq.push(['_setDomainName', '.opensecure.org']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
  })();

</script>
<!-- Grab Google CDN's jQuery. fall back to local if necessary --> 
<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.4.2/jquery.min.js"></script> 
<script src="/js/diQuery-collapsiblePanel.js"></script> 
<script src="/js/prettify.js"></script> 

<script type="text/javascript">

jQuery(document).ready(function() {

  var url = gup('url');
  var id = gup('id');
 
  jQuery(".content").hide();

  //toggle the componenet with class msg_body
  jQuery(".heading").click(function()
  {
    jQuery(this).next(".content").slideToggle(500);
  });

  if(url.length != 0) {
      \$("input#url").val(url);
      auto_submit_url();
  }

  if(id.length != 0) {
      submit_id(id);
  }
    
});

</script>

<script type="text/javascript">

function gup( name )
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return unescape(results[1]);
}

function submit_id( id ) {

    \$('#latest').html("<div id='message'></div>");

    \$('#message').html("<p>Building visualization for session: " + id);

    \$('#message').hide()
        .fadeIn(500, function() {
            \$('#message').append("<img id='timer' src='/img/please_wait.gif' />");
    });

    var dataString = 'l=2' + '&guid=' + id; 
    dataString = encodeURI(dataString);

        \$.ajax({
            type: "POST",
            url: "/fs",
            data: dataString,
            dataType: "json",
            success: function(data, textStatus, jqXHR) {

                \$('#message').delay(1500);

                \$('#message').html();
                \$('#message').html("<p>Visualization Complete</p>");

                \$('#latest').hide()
                    .fadeIn(1500, function() {

                    var jsonobj = data;

                    if(jsonobj.error == "1") {
                        \$('#latest').html(jsonobj.error_message);
                        return;
                    } else {
                        \$('#latest').html(jsonobj.data);
                    }

                    prettyPrint();

		    jQuery(".content").hide();

		    //toggle the componenet with class msg_body
  		    jQuery(".heading").click(function()
  		    {
    		        jQuery(this).next(".content").slideToggle(500);
  		    });
                });
            }
        });
}

function auto_submit_url() {

    var url = \$("input#url").val(); 
    url = encodeURIComponent(url);

    var referrer = \$("input#referrer").val(); 
    referrer = encodeURIComponent(referrer);

    var ua = \$("select#ua").val(); 
    ua = encodeURIComponent(ua);

    var proxy = \$("select#proxy").val(); 
    proxy = encodeURIComponent(proxy);

    var terms = "off";
    if(\$("#terms").attr("checked")) { 
        terms = "on";
    }
    terms = encodeURIComponent(terms);

    var dataString = 'l=1' + '&url=' + url + '&referrer=' + referrer + '&ua=' + ua + '&proxy=' + proxy + '&terms=' + terms;
    dataString = encodeURI(dataString);

    \$('#latest').html("<div id='message'></div>");

    \$('#message').html("<p>Submitting Request... Please be patient as results can take up to 1 minute</p>");

    \$('#message').hide()
         .fadeIn(500, function() {
             \$('#message').append("<img id='timer' src='/img/please_wait.gif' />");
         });

    \$.ajax({
        type: "POST",
        url: "/fs",
        data: dataString,
        dataType: "json",
        success: function(data, textStatus, jqXHR) {

            var jsonobj = data;

            if(jsonobj.error == "1") {
                \$('#latest').html(jsonobj.error_message);
                return false;
            } 

            submit_id(jsonobj.data);

        }
    });
}
 
\$(function() {  
  \$(".button").click(function() { 

    auto_submit_url();

    return false;
  });  
});  

</script>
<script>
function show_about() {
    \$.ajax({
        type: "GET",
        url: "/about.html",
        dataType: "html",
        success: function(data, textStatus, jqXHR) {
            \$('#latest').html(data);
        }
    });
}
function show_privacy() {
    \$.ajax({
        type: "GET",
        url: "/privacy.html",
        dataType: "html",
        success: function(data, textStatus, jqXHR) {
            \$('#latest').html(data);
        }
    });
}
function show_terms() {
    \$.ajax({
        type: "GET",
        url: "/terms.html",
        dataType: "html",
        success: function(data, textStatus, jqXHR) {
            \$('#latest').html(data);
        }
    });
}
function show_ad() {
    \$.ajax({
        type: "GET",
        url: "/ad.html",
        success: function(data, textStatus, jqXHR) {
            \$('#latest').html("");
            \$('#latest').append(data);
        }
    });
}
</script>
</head> 
 
<body onload="prettyPrint();">
 
<div id="container"> 

<div class="align-center" id="logo">
&nbsp;
</div>


<form id="urlform" action="" method="post"> 
<div id="box">
<div id="top_nav">
<a href="#" onClick="show_ad()">Home</a> |
FAQ | <a href="#" onClick="show_about()">About Us</a>
</div>
<div id="input" style="font-size: 15px; font-weight: bold; color: #999999;">
Insert URL <input id="url" size="20" maxlength="1024" type="text" value="" class="field"> 
</div> 

<div style="height:15px"> 
</div> 

<fieldset>
<legend>
Optional
</legend>


<div id="input" style="font-size: 15px; font-weight: bold; color: #999999;">
<p>Referrer <input id="referrer" size="20" maxlength="1024" type="text" value="" class="field"></p> 
</div>

<div id="input" style="font-size: 15px; font-weight: bold; color: #999999;">
<p>User-Agent

<select id="ua">
END

my $c=0;
foreach my $user_agent (@user_agents) {
    if($c==0) { 
        print "<option selected=\"selected\" value=\"" . $user_agent->{value} . "\">" . $user_agent->{name} . "</option>";
    } else {
        print "<option value=\"" . $user_agent->{value} . "\">" . $user_agent->{name} . "</option>";
    }
    $c++;
}


print <<END;
</select></p>

</div>

<div id="input" style="font-size: 15px; font-weight: bold; color: #999999;">
<p>Proxy

<select id="proxy">
END

my $c=0;
foreach my $proxy (@proxies) {
    if($c==0) { 
        print "<option selected=\"selected\" value=\"" . $proxy->{value} . "\">" . $proxy->{name} . "</option>";
    } else {
        print "<option value=\"" . $proxy->{value} . "\">" . $proxy->{name} . "</option>";
    }
    $c++;
}


print <<END;
</select></p>

</div>
</fieldset>

<div style="height:15px"> 
</div> 

<div class="align-left">
<input name="terms" type="checkbox" class="checkbox" id="terms"  />
<label for="terms">I agree to the terms of use</label>
</div>
<div class="align-left">				
<input type="submit" class="button" value="Submit" id="button" name="check"> 
</div> 

</div> 

</form>


<div id="latest">
<div style="height:100px"> 
<script type="text/javascript"><!--
google_ad_client = "ca-pub-4692933598176032";
/* opensecure */
google_ad_slot = "2610435143";
google_ad_width = 728;
google_ad_height = 90;
//-->
</script>
<script type="text/javascript"
src="http://pagead2.googlesyndication.com/pagead/show_ads.js">
</script>
</div> 
</div> 

<div style="margin: 0px auto;display:block;text-align:left;">

<div style="position:relative;float:left;color:#686868;font-size:9pt;">
Copyright &copy; 2011 opensecure.org All rights reserved.
</div>

<div style="position:relative;float:right;color:#686868;font-size:9pt;">
<a href="#" onClick="show_terms()">Terms of Use</a> 
| 
<a href="#" onClick="show_privacy()">Privacy Policy</a> | <a href="mailto:abuse\@opensecure.org">DMCA / Abuse</a>
</div>

</div>
<div style="height:100px"> 
</div> 

</body> 
</html>

END

}

sub showScreenshot {

    my ($jsonobj, $guid, $event) = @_;

    $jsonobj->{data} .= "<p class=\"heading\">Screenshot</p>";

    $jsonobj->{data} .= "<div class=\"content\">";
    $jsonobj->{data} .= "<a href=\"/fsimage?id=$guid&t=s\" target=\"_blank\"><img border=\"1\" src=\"/fsimage?id=$guid&t=s&s=s\" /></a>";
    $jsonobj->{data} .= "</div>";
}

sub showRedirectionChain {

    my ($jsonobj, $g_iframes, $guid, $events) = @_;

    $jsonobj->{data} .= "<p class=\"heading\">Redirection Chain</p>";
    $jsonobj->{data} .= "<div class=\"content\">";

    $jsonobj->{data} .= "<a href=\"/fsimage?id=$guid&t=r\" target=\"_blank\"><img border=\"1\" src=\"/fsimage?id=$guid&t=r&s=s\" /></a>";

    $jsonobj->{data} .= "</div>";
}

sub buildChildTree {

    my ($jsonobj, $g_iframes, $domarrayref) = @_;

    foreach my $dom (@{$domarrayref}) {

        if ($dom->{url} eq "about:blank") { next; }

        $jsonobj->{data} .= "<ul>";

        $jsonobj->{data} .= "<div style=\"position: relative; background-color: azure;\">";

        $jsonobj->{data} .= "<p class=\"contenturlheader\">$dom->{url} ( $dom->{name} )</p>";
        if ($dom->{name} eq "IFRAME") {
            $g_iframes->{$dom->{url}} = $dom->{parenturl};
        }

        $jsonobj->{data} .= "</div>";

        if(defined $dom->{srcfile} && defined $dom->{filepath}) {
            $jsonobj->{data} .= "<ul>";
            my $src_payload = get_file_contents($dom->{srcfile}, 1);
            my $dom_payload = get_file_contents($dom->{filepath}, 1);

	    if(length($src_payload) > 0) {
            $jsonobj->{data} .= "<p class=\"heading\">Source Code</p>";
            $jsonobj->{data} .= "<div class=\"content\">";

            $jsonobj->{data} .= "<pre class=\"code prettyprint\" style=\"border : solid 2px #747E80; background : #ffffff; color : #000000; padding : 4px; width: 95%; height: 200px; overflow-y: scroll; scrollbar-arrow-color: 
blue; scrollbar-
face-color: #e7e7e7; scrollbar-3dlight-color: #a0a0a0; scrollbar-darkshadow-color: 
#888888\">$src_payload</pre>";
            $jsonobj->{data} .= "</div>";
	    }

            $jsonobj->{data} .= "<p class=\"heading\">Document Object Model</p>";
            $jsonobj->{data} .= "<div class=\"content\">";

            $jsonobj->{data} .= "<pre class=\"code prettyprint\" style=\"border : solid 2px #747E80; background : #ffffff; color : #000000; padding : 4px; width: 95%; height: 200px; overflow-y: scroll; scrollbar-arrow-color: 
blue; scrollbar-
face-color: #e7e7e7; scrollbar-3dlight-color: #a0a0a0; scrollbar-darkshadow-color: 
#888888\">$dom_payload</pre>";

            $jsonobj->{data} .= "</div>";
            $jsonobj->{data} .= "</ul>";
        }

        if(exists $dom->{childdoms}) {
            my $n = scalar @{ $dom->{childdoms} };
            if($n > 0) {
                buildChildTree($jsonobj, $g_iframes, $dom->{childdoms});
            }
        }

        $jsonobj->{data} .= "</ul>";

    }
}

sub showNetworkConnections {

    my ($jsonobj, $g_iframes, $summary_ref, $events) = @_;

    $jsonobj->{data} .= "<p class=\"heading\">Network Connections</p>";
    $jsonobj->{data} .= "<div class=\"content\">";
    $jsonobj->{data} .= "<table class=\"table\">";

    $jsonobj->{data} .= "<tr class=\"tabletitle\"><th>Source</th><th>Destination</th><th>Direction</th><th>Info</th></tr>";

    my $color_alt1 = "#dae2e9";
    my $color_alt2 = "#FFFFFF";
    my $current_color = "#FFFFFF";
    foreach my $event (@{$events}) {

        if(defined $event->{eventType} 
		&& ($event->{eventType} eq "connection" ||
		    $event->{eventType} eq "refresh")) {

            my ($srchost, $dsthost, $direction) = ("", "", "request");

	    if($event->{eventType} eq "connection") {
                $srchost = $event->{src};
                $dsthost = $event->{dst};
                $direction = $event->{type};
	    } elsif($event->{eventType} eq "refresh") {
                $srchost = $event->{url};
		$dsthost = $event->{refreshURI};
		$direction = "request";
	    }
	    
            my ($host1_security_pg, $host1_uncat, $host1_lookup) =
                category_lookup($srchost);
            my ($host2_security_pg, $host2_uncat, $host2_lookup) =
                category_lookup($dsthost);

            my $host1_cat = get_category_name($host1_lookup); 
            my $host2_cat = get_category_name($host2_lookup); 


            my $info = "";

            my $xtra = "";
            my $content_type = "";

            if($event->{type} eq "request") {
                if($g_iframes->{$dsthost} eq $srchost) {
                    $info .= "LIVE IFRAME";
                    if($host2_security_pg == 1) {
		        $$summary_ref .= "Live IFRAME leading to SECURITY PG site: " . $dsthost . "<br /><br />";
		    } else {
		        $$summary_ref .= "Live IFRAME leading to site: " . $dsthost . "<br /><br />";
		    }
		} elsif($host2_security_pg == 1) {
		    $$summary_ref .= "Connection made to SECURITY PG site: " . $dsthost . "<br /><br />";
                } 
                if($host2_uncat == 1) {
		    $$summary_ref .= "Connection made to an UNCATEGORIZED site: " . $dsthost . "<br /><br />";
	        }
            } elsif($event->{type} eq "response") {
                $info .= "Status: " . $event->{status};
                if($event->{status} =! /3[0-9][0-9]/) {
                    foreach my $header (@ {$event->{headers}}) {
                        if($header->{name} eq "Content-Type") {
                            $content_type = $header->{value};
                            $info .= "<br />" . $header->{name} . " : " . $header->{value};
                        }
                        if($header->{name} eq "Location") {
                            $info .= "<br />" . $header->{name} . " : " . $header->{value};
			}
	            }	
		}


                if($content_type =~ m/text/i || $content_type =~ m/javascript/i) {
                # response data will come in the filepath
                my $filepath = $event->{filepath};
                my $response_payload = get_file_contents($event->{filepath}, 1);
                $xtra .= "<p class=\"heading\">Response payload</p>";
                $xtra .= "<div class=\"content\">";

                $xtra .= "<pre class=\"code prettyprint\" style=\"border : solid 2px #747E80; background : #ffffff; color : #000000; padding : 4px; width: 95%; height: 200px; overflow-y: scroll; scrollbar-arrow-color: 
blue; scrollbar-
face-color: #e7e7e7; scrollbar-3dlight-color: #a0a0a0; scrollbar-darkshadow-color: 
#888888\">$response_payload</div>";

                $xtra .= "</pre></div></p>";
                }

            }

            if($event->{type} eq "request" && ($host1_security_pg == 0 && $host2_security_pg == 0)) {
                $direction = "<img src=\"/img/green-arrow-right.png\" />";    
            } elsif($event->{type} eq "request") {
                $direction = "<img src=\"/img/red-arrow-right.png\" />";    
            } elsif($event->{type} eq "response" && ($host2_security_pg == 0 && $host1_security_pg == 0)) {
                $direction = "<img src=\"/img/green-arrow-left.png\" />";    
            } elsif($event->{type} eq "response") {
                $direction = "<img src=\"/img/red-arrow-left.png\" />";    
            }

            if($current_color eq $color_alt1) {
                $current_color = $color_alt2;
            } else {
                $current_color = $color_alt1;
            }

            $jsonobj->{data} .= "<tr bgcolor=\"$current_color\"><td>$srchost ($host1_cat)</td><td>$dsthost ($host2_cat)</td><td>$direction</td><td>$info $xtra</td></tr>";

        }

    }

    $jsonobj->{data} .= "</table>";
    $jsonobj->{data} .= "</div>";
}

sub showURLVoid {

    my ($jsonobj, $url) = @_;

     # make sure there is a protocol
    if ($url =~ /^.*:\/\/.*$/) {
        eval {
            my $u1 = URI->new($url);
            $url = $u1->host;
	};
    }

    $url = uri_escape($url);

    $jsonobj->{data} .= "<p class=\"heading\">URLVoid.com Results</p>";
    $jsonobj->{data} .= "<div class=\"content\">";
    $jsonobj->{data} .= "<iframe src=\"http://www.urlvoid.com/scan/$url\" width=\"100%\" height=\"300\" />";
    $jsonobj->{data} .= "</div>";
}

sub showRawEvents {

    my ($jsonobj, $events) = @_;

    my $json = JSON::XS->new;
    my $str =  $json->encode($events);

}
