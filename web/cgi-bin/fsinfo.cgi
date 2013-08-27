#!/usr/bin/perl

use strict;
use IO::Socket;
use JSON::XS;
use MIME::Base64;
use DBI;
use File::stat;
use File::Spec::Functions;
use Cwd;
use URI;
use CGI qw(:standard);
use Fireshark;
use Image::Magick;
use URI::Escape;

my $g_size = uri_unescape(param('s')) || '';
my $g_type = uri_unescape(param('t')) || '';
my $g_id = uri_unescape(param('id')) || '';

getAllURLs();

sub getAllURLs {

    print "Content-type: text/html\n\n";

    my $jsonstr;
    my $events;
    my $json = JSON::XS->new;

    my ($dbh, $query, $query_handle);

    # PERL DBI CONNECT
    $dbh = DBI->connect("DBI:mysql:fireshark","webdev","ENTER_YOUR_PASSWORD_HERE");

    # PREPARE THE QUERY
    $query = "SELECT fsevents_id, adate, events, msduration, url, keyword, params, INET_NTOA(ipaddr) FROM fsevents";

    $query_handle = $dbh->prepare($query);
    if($!) {

    }
   
    # EXECUTE THE QUERY
    $query_handle->execute();
    if($!) {

    }

    # BIND TABLE COLUMNS TO VARIABLES
    my ($fsevents_id, $adate, $e, $msduration, $url, $keyword, $params, $ipaddr);
    $query_handle->bind_columns(\$fsevents_id, \$adate, \$e, \$msduration, \$url, \$keyword, \$params, \$ipaddr);

    # LOOP THROUGH RESULTS
    my $url_decoded = "";
    my $all_urls = "";
    while($query_handle->fetch()) {
        $jsonstr = decode_base64($e);
        $url_decoded = decode_base64($url);
        $all_urls .= $fsevents_id . " " . $adate . " " . $ipaddr . " " . $url_decoded . "<br \>";
    }

    eval { $events = $json->decode($jsonstr); };
    if($@) {

    }

    my $ssData;
    my $g_iframes = {};
    foreach my $event (@{$events}) {

        if(defined $event->{eventType} && $event->{eventType} eq "contentloaded") {
	    #if($type eq "s") {
                #$ssData = getScreenShot($event, $size);
	    #    last;
	    #} else {
            #    buildChildTree($g_iframes, $event->{doms});
	    #}

	    last;
        }
    }

    #if($type eq "r") {
        #$ssData = printRedirectionChain($g_iframes, $events, $size);
    #}

    print $all_urls;
}

sub getScreenShot {
	
    my ($event, $size) = @_;

    my $img = $event->{ssfile};
    my $imgsize = $event->{ssfilesize};

    my $filesize;
    eval { $filesize = stat($img)->size; };

    my $offset = 0;
    open FILE, "$img";
    binmode FILE;
    my ($buf, $data, $n);
    while(($n = read FILE, $data, 4) != 0) {
        $buf .= $data;
        $offset += $n;
    }
    close FILE;

    if(length($buf) == 0) {
        $offset = 0;
    	open FILE, "/var/www/img/ina.png";
    	binmode FILE;
    	while(($n = read FILE, $data, 4) != 0) {
            $buf .= $data;
            $offset += $n;
        }
        close FILE;
    }

    # http://www.imagemagick.org/script/perl-magick.php#blobs
    if(length($buf) > 0) {
        if($size eq "s") {
            my $image = Image::Magick->new(magick=>'png');
            my ($width, $height, $fsize, $format) = $image->Ping(blob=>$buf);
	    while($width > 400) {
	        $width -= 20;
	        $height -= 20;
	    }
            my $geometry = $width . "x" . $height . "!";
            if($image->BlobToImage($buf) == 1) {
                $image->Resize(geometry=>$geometry);
                my @blobs = $image->ImageToBlob();
	        $buf = $blobs[0];
	    }
        }
    }

    return $buf;
}

sub printRedirectionChain {

    my ($g_iframes, $events, $size) = @_;

    my $g = GraphViz->new(width => 30, height => 30, overlap => 'false', layout => 'neato');

    foreach my $event (@{$events}) {
        if(defined $event->{eventType} && $event->{eventType} eq "connection") {

            my $srchost = $event->{src};
            my $dsthost = $event->{dst};

            if ($srchost !~ /^.*:\/\/.*$/) {
                next;
            }
            if ($dsthost !~ /^.*:\/\/.*$/) {
                next;
            }

            my $u1 = URI->new($srchost);
            my $u2 = URI->new($dsthost);

            my $host1 = $u1->host;
            my $host2 = $u2->host;

            $g->add_node($host1, style => "filled", fillcolor => "white", fontcolor => "black");
            $g->add_node($host2, style => "filled", fillcolor => "white", fontcolor => "black");

            if ($host1 ne $host2) {
                if(defined $g_iframes) {
                    if(exists $g_iframes->{$u2} && $g_iframes->{$u2} eq $u1) {
                        $g->add_edge($host1 => $host2, label => 'iframe');
                    } elsif(defined $event->{type} and
                        $event->{type} eq "response" and
                            defined $event->{status}) {

                        $g->add_edge($host1 => $host2, label => $event->{status});
                    } else {
                        $g->add_edge($host1 => $host2);
                    }
                } else {
                    $g->add_edge($host1 => $host2);
                }
            }
        }
    }

    my $buf;
    $g->as_png(\$buf); # save data in a scalar

    # http://www.imagemagick.org/script/perl-magick.php#blobs
    if(length($buf) > 0) {
        if($size eq "s") {
            my $image = Image::Magick->new(magick=>'png');
            my ($width, $height, $fsize, $format) = $image->Ping(blob=>$buf);
	    while($width > 600) {
	        $width -= 20;
	        $height -= 20;
	    }
            my $geometry = $width . "x" . $height . "!";
            if($image->BlobToImage($buf) == 1) {
                $image->Resize(geometry=>$geometry);
                my @blobs = $image->ImageToBlob();
	        $buf = $blobs[0];
	    }
        }
    }

    return $buf;
}

sub buildChildTree {

    my ($g_iframes, $domarrayref) = @_;

    foreach my $dom (@{$domarrayref}) {

        if ($dom->{url} eq "about:blank") { next; }

        if ($dom->{name} eq "IFRAME") {
            $g_iframes->{$dom->{url}} = $dom->{parenturl};
        }

        if(defined $dom->{srcfile} && defined $dom->{filepath}) {
            #my $src_payload = get_file_contents($dom->{srcfile}, 1);
            #my $dom_payload = get_file_contents($dom->{filepath}, 1);
        }

        if(exists $dom->{childdoms}) {
            my $n = scalar @{ $dom->{childdoms} };
            if($n > 0) {
                buildChildTree($g_iframes, $dom->{childdoms});
            }
        }

    }
}

