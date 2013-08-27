#!/usr/bin/perl

use JSON::XS;

my $profiles_info;
my $profile_info = {};

$profile_info->{name} = "5556";
$profile_info->{profile_dir} = "dir.5556";
push(@$profiles_info, $profile_info);

$profile_info->{name} = "3344";
$profile_info->{profile_dir} = "dir.3344";
push(@$profiles_info, $profile_info);

my $json = encode_json($profiles_info);
print $json . "\n";

