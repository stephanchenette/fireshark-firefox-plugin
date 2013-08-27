#! /usr/bin/perl -w

use strict;
use warnings;
use Data::GUID;
use POSIX;
use POSIX ':sys_wait_h';
use IPC::Open2;
use IO::Handle;
use File::Path;
use File::Copy;
use JSON::XS;

if ($#ARGV <0) {
        print "please specify an option. Exiting..." . $#ARGV . "\n";
        exit 1;
}

my $option = $ARGV[0];
unless($option eq "-s" || $option eq "-c" || $option eq "-d") {
        print "please specify either -s (show), -c (create), or -d (delete) as an option. Exiting...\n";
        exit 1;
}

# 1= logging is on
my $logging       = 1;

# process keeper
my @children;

# real ID 
my $real_user = getpwuid($<);
# effective ID
my $effective_user = getpwuid($>);

print "real use is $real_user and effective user is $effective_user\n";
if ($effective_user ne "fireshark") {
    print "effective user is not fireshark - exiting\n";
    exit 1;
}

# home dir
my $home_dir   = "/home/$effective_user";

# log file path
my $logFilePath   = "/home/$effective_user/";
my $logFile       = $logFilePath . "ffprofiles" . ".log";

# profiles config path
my $profiles_config_path = "/home/$effective_user/";
my $profiles_config_file = $profiles_config_path . "ffprofiles" . ".js";

my $profiles_dir = "/home/$effective_user/.mozilla/firefox";

my $template_prefs_file = $home_dir . "/" . "prefs.js"; 


print "profiles dir: $profiles_dir\n";

# turn on logging
if ($logging)
{
        open LOG, ">>$logFile";

        # make the log file "hot" - turn off buffering
        select((select(LOG), $|=1)[0]);
}

if($option eq "-c") {

    my $count = $ARGV[1];

    my $profiles_info; 

    local $/=undef;
    if(open(PCONFIGFILE_READ, "<$profiles_config_file")) {
        my $jsonstr = <PCONFIGFILE_READ>; 
        close(PCONFIGFILE_READ);

        eval {
	    $profiles_info = decode_json($jsonstr);
        };
        if($@) {
            print "no profiles currently exist\n";
        } else {
            print scalar @{ $profiles_info } . " profiles currently exist\n";
        }
    } else {
        print "no profiles currently exist\n";
    }

    print "Creating $count firefox profiles\n";

    for(my $i=0; $i<$count; $i++) {
        my $p = create_profile();
        unless($p->{success}) {
            print "profile creation failed\n";
            last;
        } else {
            print "profile $i created successfully. name = $p->{name}\n";

	    my $pdir = $profiles_dir . "/" . $p->{profile_dir};

	    copy($template_prefs_file, $pdir) or die "failed to copy prefs file: $!";

            my $profile_info = {};
            $profile_info->{name} = $p->{name};
            $profile_info->{profile_dir} = $p->{profile_dir};
	    push(@$profiles_info, $profile_info);
	}
    }

    # save profile_info to file
    # encode into json format

    my $json = encode_json($profiles_info);

    open(PCONFIGFILE, ">$profiles_config_file") or die print "failed to open profiles config file\n"; #open for write, overwrite
    print PCONFIGFILE "$json";
    close(PCONFIGFILE);

} elsif($option eq "-s") {

    my $pi = get_all_profile_info($profiles_dir);
    print "there are " . @$pi . " profiles\n";

} elsif($option eq "-d") {

    my $profiles_dir = "/home/$effective_user/.mozilla/firefox";
    delete_all_profiles($profiles_dir);
    unlink $profiles_config_file;
}

##################################################################3

# add a line to the log file
sub logEntry
{
        my ($logText) = @_;
        my ( $sec, $min, $hour, $mday, $mon, $year, $wday, $yday, $isdst ) = localtime(time);
        my $dateTime = sprintf "%4d-%02d-%02d %02d:%02d:%02d", $year + 1900, $mon + 1, $mday, $hour, $min, $sec;

        if ($logging)
        {
                print LOG "$dateTime $logText\n";
        }
}

sub create_profile
{
    my $pid = undef;
    my $child_exit_status = undef;
    my ($infh, $outfh) = (undef, undef); # these are the FHs for our child

    # generate a unique profile name
    my $guid = Data::GUID->new;
    my $guid_string = $guid->as_string;

    eval{
        my $cmd = "xvfb-run --auto-servernum firefox -CreateProfile $guid_string";
        logEntry("issuing command to create profile\n");
        $pid = open2($infh, $outfh, $cmd);
        my $reaped;
        while(1) {
            $reaped = waitpid($pid, WNOHANG);
            if($reaped == -1 or $reaped == 0) {
    		logEntry("profile creation process complete");
                last;
            } else { logEntry("reaped: $reaped"); }
        }
    };

    if($@) {
        return {success => 0, name => $guid_string, profile_dir => undef};
    }

    if(defined $pid) {
        push @children, $pid;
    }

    # effective ID
    my $effective_user = getpwuid($>);
    my $profiles_dir = "/home/$effective_user/.mozilla/firefox";

    my $r = get_profile_id($profiles_dir, $guid_string);

    return $r;
} 

sub get_profile_id {

    logEntry("in get_profile_id");

    my ($profiles_dir, $guid) = @_;

    my $file;
    my $profile_exists = 0;

    logEntry("profile dir = $profiles_dir");
    logEntry("guid = $guid");

    if(length($profiles_dir) == 0 || length($guid) == 0) {
        logEntry("not sufficient arguments, returning");
        return {success => 0, name => $guid, profile_dir => undef};
    }

    my $try = 0;
    my $max_tries = 10;
    my $sleep = 4;
    while(1) {
        opendir DIR, "$profiles_dir" or return {success => 0, name => $guid, proprofile_dir => undef};
        while ($file = readdir(DIR)) {

            if ($file =~ m/$guid/) {

                $profile_exists = 1;
                last;
            }

        }
        closedir DIR;
        if($profile_exists == 0) {
            if($try == $max_tries) {
                logEntry("have tried $try times to find dir, unsuccessful.");
	        last;
	    } else {
                $try++; 
                logEntry("try $try, sleeping, trying again...");
                sleep($sleep);
	    }
        } else {
            logEntry("dir found!!");
            last;
        }
    }

    if($profile_exists == 0) {
        logEntry("unable to find newly created profile dir, returning");
        return {success => 0, name => $guid, profile_dir => undef};
    }

    logEntry("leaving get_profile_id");
    return {success => 1, name => $guid, profile_dir => $file};
}

sub get_guid
{
    # generate a unique guid
    my $guid = Data::GUID->new;
    my $guid_string = $guid->as_string;
    return $guid_string;
}

sub delete_all_profiles {

    logEntry("in delete_all_profiles");

    my ($profiles_dir) = @_;
    my $file;

    logEntry("profile dir = $profiles_dir");

    if(length($profiles_dir) == 0) {
        logEntry("not sufficient arguments, returning");
        return;
    }

    opendir DIR, "$profiles_dir" or return;

    my $profiles_deleted = 0;
    while ($file = readdir(DIR)) {

        my $testfile = $profiles_dir . "/" . $file . "/prefs.js";
        my $profile_dir = $profiles_dir . "/" . $file;
        if(-f $testfile) {
            my $files_deleted = rmtree($profile_dir);
            $profiles_deleted++;
	}
    }

    closedir DIR;

    my $profile_ini_file = $profiles_dir . "/" . "profiles.ini";
    print "profiles.ini: $profile_ini_file\n";
    if(-f $profile_ini_file) {
        unlink($profile_ini_file) or print "profiles.ini was not deleted. reason: $!\n";
    }

    print "deleted $profiles_deleted profiles\n";

    logEntry("leaving delete_all_profiles");
    return;
}

sub get_all_profile_info {

    logEntry("in get_all_profile_info");

    my ($profiles_dir) = @_;
    my $file;
    my @profile_dirs;
    my @profiles;

    logEntry("profile dir = $profiles_dir");

    if(length($profiles_dir) == 0) {
        logEntry("not sufficient arguments, returning");
        return;
    }

    opendir DIR, "$profiles_dir" or return;

    my @profiles_info;
    while ($file = readdir(DIR)) {

        my $testfile = $profiles_dir . "/" . $file . "/prefs.js";
        if(-f $testfile) {
	    my ($random, @rest) = split(/\./, $file);
            my $profile = join('', @rest); 

            logEntry("profile_dir: $file profile: $profile\n");
            my $p = {};
            $p->{name} = $profile;
            $p->{profile_dir} = $file;
            push(@profiles_info, $p);
	}
    }

    closedir DIR;

    logEntry("leaving get_all_profile_info");
    return \@profiles_info;
}
