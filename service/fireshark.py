#!/usr/bin/python

# this is the fireshark service, version 2.02
# author: Stephan Chenette fireshark AT fireshark DOT org

from twisted.application import internet, service
from twisted.internet.protocol import ServerFactory, Protocol
from twisted.python import log

import logging

# set up logging
logging.basicConfig(format='%(asctime)s %(levelname)s:%(message)s',
					filename='/home/fireshark/fireshark.log',
					level=logging.DEBUG)

import simplejson
import sys
import uuid
sys.path.append('/usr/sbin')

from firesharkprofilemanager import *
from firefoxprocess import *

class FiresharkProtocol(Protocol):

	def __init__(self):
		self.connection_buffer = "" 
		self.running = False
		self.sentClientEvents = False

		self.sessionid = uuid.uuid1()
		logging.debug("FiresharkProtocol::__init__ sessionid: %s" % self.sessionid)

	def handleProcessTimedOut(self):
		logging.debug("FiresharkProtocol::handleProcesstimedout")
		self.dirtyExit();

	def closeConnection(self):

		logging.debug("FiresharkProtocol::closeConnection called")

		if self.sentClientEvents == True:
			logging.debug("FiresharkProtocol::closeConnection DID send events to client")
			logging.debug("FiresharkProcool::closeConnection closing connection")
			self.transport.loseConnection()
		else:
			logging.debug("firesharkProtocol::closeConnection did NOT send events to client_____")
			logging.debug("firesharkProtocol::closeConnection NOT closing connection")

	def dirtyExit(self):

		logging.debug("FiresharkProtocol::dirtyExit called")

		try:
			if self.profile is None:
				logging.debug("FiresharkProtocol.profile is blank")
			else:
				logging.debug("FiresharkProtocol.profile is NOT blank")

		except AttributeError:
			logging.debug("FiresharkProtocol.profile hasn't yet been initializd (NOT an error)")

		try:
			if self.checkForAvailableProfileLoop.running:
				logging.debug("FiresharkProtocol.checkForAvailableProfileLoop is running. stopping...")
				self.checkForAvailableProfileLoop.stop()
			else:
				logging.debug("FiresharkProtocol.checkForAvailableProfileLoop is NOT running")
		except AttributeError:
			logging.debug("FiresharkProtocol.checkForAvailableProfileLoop exist, but is NOT running")

		try: 
			if self.checkIfFirefoxWasKilledLoop.running:
				logging.debug("FiresharkProtocol.checkIfFirefoxWasKilled is running.")
			else:
				logging.debug("FiresharkProtocol.checkIfFirefoxWasKilled is NOT running. starting...")
				self.checkIfFirefoxWasKilledLoop = LoopingCall(self.checkIfFirefoxWasKilled)
				self.checkIfFirefoxWasKilledLoop.start(0.5, now=True)
		except AttributeError:
			logging.debug("FiresharkProtocol.checkIfFirefoxWasKilled exist but is NOT running. starting...")
			self.checkIfFirefoxWasKilledLoop = LoopingCall(self.checkIfFirefoxWasKilled)
			self.checkIfFirefoxWasKilledLoop.start(0.5, now=True)

		try:
			self.firefoxProcess.dirtyExit()

		except AttributeError:
			pass

		logging.debug("FiresharkProtocol::dirtyExit returning...")

	def checkForAvailableProfile(self):
		logging.debug("FiresharkProtocol::checkForAvailableProfile called")
		profile = fs_profiles_manager.get_next_available_profile() 
		if profile is None:
			return
		else:
			if self.checkForAvailableProfileLoop.running:
				self.checkForAvailableProfileLoop.stop()

		self.profile = profile

		logging.debug("using profile: %s", self.profile['name']) 

		self.firefoxProcess = FirefoxProcess(self, self.profile, self.params)
		self.firefoxProcess.run()

		self.checkForEventsFileLoop = LoopingCall(self.checkIfEventsFileExists)
		self.checkForEventsFileLoop.start(0.5)
		
	def run(self):

		self.running = True
		self.checkForAvailableProfileLoop = LoopingCall(self.checkForAvailableProfile)
		self.checkForAvailableProfileLoop.start(0.5)

	def checkIfFirefoxWasKilled(self):
		logging.debug("FiresharkProtocol::checkIfFirefoxWasKilled called")
		r = self.firefoxProcess.checkIfFirefoxWasKilled()
		logging.debug("firefoxProcess.checkIfFirefoxWasKilled returned : %d" % r)
		if r == False:
			logging.debug("\tFirefox is ALIVE")
			pass
		else:
			logging.debug("\tFirefox is DEAD")
			if self.checkIfFirefoxWasKilledLoop.running:
				self.checkIfFirefoxWasKilledLoop.stop()
				logging.debug("FiresharkProtocol::checkIfFirefoxWasKilled checkifFirefoxWasKilledLoop stopped")
			else:
				logging.debug("FiresharkProtocol::checkIfFirefoxWasKilled apparently checkIfFirefoxWasKilledLoop is NOT running")

			if self.profile is not None:
				logging.debug("FiresharkProtocol::checkIfFirefoxWasKill giving back profile")
				fs_profiles_manager.add_as_available_profile(self.profile)
				self.profile = None

			self.closeConnection()

 	def checkIfEventsFileExists(self):
		logging.debug("FiresharkProtocol::checkIfEventsFileExists called")
		events = self.firefoxProcess.checkIfEventsFileExists()
		if events is None:
			pass
		else:
			eventsstr = simplejson.dumps(events)

			if self.checkForEventsFileLoop.running:
				logging.debug("FiresharkProtocol::checkIfEventsFileExists checkForEventsFileLoop was running. stopping...")
				self.checkForEventsFileLoop.stop()

			try:
				if not self.checkIfFirefoxWasKilledLoop.running:
					logging.debug("FiresharkProtocol::checkIfEventsFileExists checkIfFirefoxWasKilledLoop starting")
					self.checkIfFirefoxWasKilledLoop = LoopingCall(self.checkIfFirefoxWasKilled)
					self.checkIfFirefoxWasKilledLoop.start(0.5)
				else:
					logging.debug("FiresharkProtocol::checkIfEventsFileExists checkIfFirefoxWasKilledLoop already running")
			except AttributeError:
				logging.debug("FiresharkProtocol::checkIfEventsFileExists checkIfFirefoxWasKilledLoop starting")
				self.checkIfFirefoxWasKilledLoop = LoopingCall(self.checkIfFirefoxWasKilled)
				self.checkIfFirefoxWasKilledLoop.start(0.5)
		
			logging.debug("FiresharkProtocol::checkIfEventsFileExists writing events buffer to client socket")
			self.sentClientEvents = True
			self.transport.write(eventsstr)

	def connectionLost(self, reason):
		logging.debug("FiresharkProtocol::connectionLost called")
		self.dirtyExit()

	def connectionMade(self):

		connection_id = self.transport.getPeer().host + str(self.transport.getPeer().port)

		logging.debug("connection_id: %s - connection made from: %s:%d", connection_id, self.transport.getPeer().host, self.transport.getPeer().port)

		#self.connection_buffer = { connection_id: "" } 

	def dataReceived(self, data):
        
		connection_id = self.transport.getPeer().host + str(self.transport.getPeer().port)

		logging.debug("connection_id: %s - data received from: %s:%d", connection_id, self.transport.getPeer().host, self.transport.getPeer().port)
		
		if self.running:
			logging.debug("already running")
			return

		#self.connection_buffer[connection_id] += data
		self.connection_buffer += data

		# attempt to convert string to json object to test
 		# if all data has been received
		try:
			params = simplejson.loads(self.connection_buffer)
		except ValueError: 
			# not all the data has been sent yet, thus return
			logging.debug("connection_id: %s - incomplete json string. server will continue to wait on data...", connection_id)
			return

		logging.debug("connection_id: %s - all data has been received", connection_id)

		self.params = params

		self.run()

class FiresharkFactory(ServerFactory):

	protocol = FiresharkProtocol


	def __init__(self, service):
		self.service = service


class FiresharkService(service.Service):

	def startService(self):
		service.Service.startService(self)

# configuration parameters
port = 10000
iface = 'localhost'

# this will hold the services that combine to form the fireshark server
top_service = service.MultiService()

fireshark_service = FiresharkService()
fireshark_service.setServiceParent(top_service)

# the tcp service connects the factory to a listening socket. it will
# create the listening socket when it is started
factory = FiresharkFactory(fireshark_service)
tcp_service = internet.TCPServer(port, factory, interface=iface)
tcp_service.setServiceParent(top_service)

# this variable has to be named 'application'
application = service.Application("fireshark")

# this hooks the collection we made to the application
top_service.setServiceParent(application)

# at this point, the application is ready to go. when started by
# twistd it will start the child services, thus starting up the
# fireshark server
