#!/usr/bin/python

# reference:
# http://stackoverflow.com/questions/9610417/twisted-process-execution-issues

import re
import simplejson
import sys
import os
import pwd
import uuid
import shlex
import subprocess
from optparse import OptionParser
from os import listdir
from os.path import isdir, isfile, join

from twisted.internet import defer, reactor
from twisted.internet.protocol import ProcessProtocol

def get_username():
        return pwd.getpwuid( os.getuid() )[ 0 ]

class SubProcessReturnCodeProtocol(ProcessProtocol):      
    def connectionMade(self):
	print "connectionMade"
        self.returnCodeDeferred = defer.Deferred()

    def processEnded(self, reason):
	print "processEnded"
        self.returnCodeDeferred.callback(reason.value.exitCode)

    def outReceived(self, data):
        print data

    def errReceived(self, data):
        print data

class ProfileManager():
    def __init__(self):
        print "init"
        self.create_profiles()

    @defer.inlineCallbacks

    def create_profiles(self):

	sys.stdout.write("create_profiles called \n")

	profiles = []
	for n in range(0, 3):

            guid = uuid.uuid1()
            sys.stdout.write("%s\n" % guid)

            cmd = "xvfb-run --auto-servernum firefox -CreateProfile " + str(guid)
	    args = shlex.split(cmd)

    	    exitcode = yield self.run_a_subprocess(args)
            print "Exit code: " + str(exitcode)

	    profile_dir = self.get_profile_dir(guid)

	    sys.stdout.write("guid: %s\n" % guid)
	    sys.stdout.write("folder: %s\n" % profile_dir)

	    profile_info = {}
	    profile_info["name"] = str(guid)
	    profile_info["profile_dir"] = profile_dir

	    profiles.append(profile_info)

	json_string = simplejson.dumps(profiles)
	print json_string

	reactor.stop()

    def run_a_subprocess(self, args):
        pprotocol = SubProcessReturnCodeProtocol()
        reactor.spawnProcess(pprotocol, args[0], args, env=os.environ, usePTY=1)        
        return pprotocol.returnCodeDeferred
	
    def get_profile_dir(self, guid):
	username = get_username()
	"""
        if username != "fireshark":
                sys.stdout.write("must execute script as fireshark user\n")
                sys.exit()
	"""

        home_dir = "/home/" + username
        logfile_path = home_dir
        logfile = logfile_path + "/ffprofiles.log"

        profiles_config_path = home_dir
        profiles_config_file = profiles_config_path + "/ffprofiles.js"

        profiles_dir = home_dir + "/.mozilla/firefox"

        template_prefs_file = home_dir + "/prefs.js"

	for n in range(0, 3):
	    for f in listdir(profiles_dir):
		if isdir(join(profiles_dir, f)):
	            if str(f).find(str(guid)) > 0:
			return f 

	return ""
	

if __name__ == '__main__':
    pm = ProfileManager()
    reactor.run()
