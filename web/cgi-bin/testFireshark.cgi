#!/usr/bin/perl

use strict;
use IO::Socket;
use JSON::XS;
use MIME::Base64;
use File::stat;
use GraphViz;
use URI;
use Time::HiRes qw(time gettimeofday tv_interval);

print "Content-type: text/html; charset=iso-8859-1\n\n";

print "testing fireshark service...\n";

my $json = JSON::XS->new;
my $events;

my ( $host, $port, $kidpid, $sock, $line, $fromaddr, $buf );

( $host, $port ) = ('127.0.0.1', 10000);

my $ref = {};
my @urls = ("http://www.google.com", "http://www.yahoo.com");
$ref->{urls} = \@urls;
my $json = JSON::XS->new;
my $jsonstr = $json->encode($ref) . "\n";

# create a tcp connection to the specified host and port
$sock = IO::Socket::INET->new(
	Proto    => "tcp",
	PeerAddr => $host,
	PeerPort => $port
);

if($@) {
    print "error creating socket $!";
    exit 1;
}


$sock->autoflush(1);    # so output gets there right away

print $sock $jsonstr ;
#$sock->shutdown(1);

my $t0 = time;
my $tmpbuf;
my $nloops = 0;
while(1) {

	my $fromaddr = $sock->recv( $tmpbuf, 500000 );
        $buf .= $tmpbuf;
        eval { my $check = $json->decode($buf); };
        if($@) {
            print "looping again...$buf\n";
            $nloops++;
            my $amount = length($buf);
	    sleep(1);
 	} else {
            #print "no error on eval $!\n";
	    last;
	}
}

#print "<p>$buf</p>";
eval { $events = $json->decode($buf); };
if($@) {
    print "error decoding json string: $!\n";
    print "$buf\n";
}

my $str = $json->encode($events);
print "$str\n";

my $elapsed = time - $t0;
printf("\ntotal time: %.4f\n", $elapsed);
my $amount = length($buf);
printf("\nnumber of bytes: %u\n", $amount);
printf("\nnumber of loops: %u\n", $nloops);

unless(defined $events) {
    print "events is not defined";
}	
