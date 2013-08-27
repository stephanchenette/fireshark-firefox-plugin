#!/usr/bin/python

import sys
import os
import pwd
import uuid
from optparse import OptionParser
from twisted.internet import reactor

def show_profiles():
	
	return;

def create_profile():

	sys.stdout.write("create profile called \n")
	guid = uuid.uuid1()
	sys.stdout.write("%s\n" % guid)
	cmd_process = "xvfb-run"
	cmd = "xvfb-run --auto-servernum firefox -CreateProfile " + guid
	cmd_array = cmd.split(" ")

	processProtocol = MyProcessProtocol()
	subprocess = reactor.spawnProcess(processProtocol, cmd_process, cmd_array, env = os.environ, usePTY=1)
	return;

def delete_profiles():
	return;

def get_username():
	return pwd.getpwuid( os.getuid() )[ 0 ]

if __name__ == '__main__':

	username = get_username()
	if username != "fireshark":
		sys.stdout.write("must execute script as fireshark user\n")
		sys.exit()

	home_dir = "/home/" + username
	logfile_path = home_dir
	logfile = logfile_path + "/ffprofiles.log"

	profiles_config_path = home_dir
	profiles_config_file = profiles_config_path + "/ffprofiles.js"

	profiles_dir = home_dir + "/.mozilla/firefox"

	template_prefs_file = home_dir + "/prefs.js"


	parser = OptionParser()

	parser.add_option("-v", "--verbose",
                      action="store_true", dest="verbose")

	parser.add_option("-s", "--s", 
		  action="store_true", dest="show", default=False,
                  metavar="SHOW", help="show current profiles")

	parser.add_option("-c", "--c", dest="create",
                  metavar="CREATE", help="create new profiles")

	parser.add_option("-d", "--d", 
		  action="store_true", dest="delete", default=False,
                  metavar="DELETE", help="delete all profiles")

   	(options, args) = parser.parse_args()

	if options.show: 
		if options.delete or options.create:
			parser.error("please only provide one actionable option");
			exit;
    		if options.verbose:
			print "calculating number of profiles..."
	if options.create: 
		if options.delete or options.show:
			parser.error("please only provide one actionable option");
			exit;
    		if options.verbose:
			print "attempting to create %s profiles..." % options.create
			for index in range(int(options.create)):
				create_profile()
	if options.delete: 
		if options.create or options.show:
			parser.error("please only provide one actionable option");
			sys.exit()
    		if options.verbose:
			print "deleting all profiles..."

