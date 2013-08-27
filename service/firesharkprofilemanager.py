#!/usr/bin/python 

import simplejson
import os
import pwd 
import logging

class FiresharkProfileManager:
    # This Class is responsible for managing firefox profiles

	def __init__(self):
		username = pwd.getpwuid( os.getuid() )[0]
		logging.debug("current user: %s" % username)
		fireshark_home_dir = "/home/" + username
		profiles_file = fireshark_home_dir + "/" + "ffprofiles.js"
		json_string = open( profiles_file, 'r' ).read()
		self.profiles = simplejson.loads( json_string )

	def add_as_available_profile(self, profile):
		logging.debug('Number of profiles was: %u', len(self.profiles))
		self.profiles.append(profile)
		logging.debug('Number of profiles now: %u', len(self.profiles))

	def get_next_available_profile(self):

		try:
			self.profiles
		except NameError:
			return None 

		logging.debug(type(self.profiles))
		logging.debug(len(self.profiles))

		if len(self.profiles) == 0:
			return None

		logging.debug('Number of profiles was: %u', len(self.profiles))
		p = self.profiles.pop()
		logging.debug('Number of profiles now: %u', len(self.profiles))
		return p 

fs_profiles_manager = FiresharkProfileManager();
