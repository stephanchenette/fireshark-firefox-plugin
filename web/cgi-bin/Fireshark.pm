package Fireshark;

use strict;
use IO::Socket;
use Time::HiRes qw(time gettimeofday tv_interval);

use vars qw($VERSION @ISA @EXPORT @EXPORT_OK);

require Exporter;

@ISA = qw(Exporter AutoLoader);

@EXPORT = qw(
analyze_via_fireshark
);

$VERSION = '2.00';

sub analyze_via_fireshark {

my ($url, $referrer, $ua, $proxy) = @_;

my ( $events, $host, $port, $kidpid, $sock, $line, $fromaddr, $buf );

( $host, $port ) = ('127.0.0.1', 10000);

my @urls;
my $ref = {};

push(@urls, $url);

$ref->{urls} = \@urls;

$ref->{urlLoadTimeout} = 100000;
#$ref->{httpUserAgent} = "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8b) Gecko/20050217";
$ref->{httpUserAgent} = $ua;
$ref->{httpReferrer} = $referrer;
$ref->{httpProxy} = $proxy;

my $json = JSON::XS->new;
my $jsonstr = $json->encode($ref) . "\n";

# create a tcp connection to the specified host and port
$sock = IO::Socket::INET->new(
	Proto    => "tcp",
	PeerAddr => $host,
	PeerPort => $port
);

if($@) {
    exit 1;
}

$sock->autoflush(1);    # so output gets there right away

print $sock $jsonstr ;

my $t0 = time;
my $tmpbuf;
my $nloops = 0;
while(1) {

	my $fromaddr = $sock->recv( $tmpbuf, 50000 );
        $buf .= $tmpbuf;

        eval { my $check = $json->decode($buf); };
        if($@) {
            $nloops++;
            my $amount = length($buf);
	    sleep(1);
 	} else {
	    last;
	}
}

eval { $events = $json->decode($buf); };
if($@) {
    print STDERR "error decoding json string: $!\n";
}

my $elapsed = time - $t0;

unless(defined $events) {
    print STDERR "events is not defined";
}	

    return ($elapsed, $jsonstr, $events);
}

1;
__END__
