#!/usr/bin/python 

from twisted.internet import reactor, protocol, error, defer
from twisted.internet.task import LoopingCall

import simplejson
import sys
import errno
import os
import signal
import pwd 
import logging
import shlex
import subprocess

class TimedProcessProtocol(protocol.ProcessProtocol):

	def __init__(self, firefoxProcess, firesharkProtocol, timeout):
		self.timeout = timeout
		self.firesharkProtocol = firesharkProtocol
		self.firefoxProcess = firefoxProcess
		self.killed = False

	def isProcessDead(self):
		logging.debug("TimedProcessProtocol::isProcessDead called")
		if self.killed == False:
			logging.debug("TimedProcessProtocol process is NOT dead")
			return False
		else:
			logging.debug("TimedProcessProtocol process is dead!!!")
			return True 

	def killProcessIfAlive(self):
		logging.debug("killProcessIfAlive called")
		try:
			if self.killed is False:
				os.kill(-self.transport.pid, signal.SIGTERM)
		except error.ProcessExitedAlready:
			logging.debug("process already exited")
			pass
		
	def connectionMade(self):
		logging.debug("connection made timeout = %d", self.timeout)

		def onTimer():
			logging.debug("timeout triggered")
			self.firefoxProcess.handleProcessTimedOut()
			self.firesharkProtocol.handleProcessTimedOut()

		d = reactor.callLater(self.timeout, onTimer)

	def outReceived(self, data):
		logging.debug("output: %s", data)

	def errReceived(self, data):
		logging.debug("errReceived %s", data)

	def errConnectionLost(self):
		logging.debug("errConnectionLost")

	def inConnectionLost(self):
		logging.debug("inConnectionLost")

	def processExited(self, reason):
		logging.debug("process exited, status %s", reason.value.exitCode)
		self.killed = True

class FirefoxProcess:
	# This Class is responsible for executing, communicating with
	#  and finally killing a firefox processs 

	def handleProcessTimedOut(self):
		self.processTimedOut = True

	def dirtyExit(self):

		logging.debug("FirefoxProcess::dirtyExit called")

		self.dirtyExitCalled = True

		try:
			if self.firesharkReadyLoop.running:
				logging.debug("FirefoxProcess.firesharkReadyLoop IS running. stopping...")
				self.firesharkReadyLoop.stop()
		except AttributeError:
			logging.debug("FirefoxProcess.firesharkReadyloop is NOT running.")

		try:
			if self.firesharkDoneLoop.running:
				logging.debug("FirefoxProcess.firesharkDoneLoop IS running. stopping...")
				self.firesharkDoneLoop.stop()
		except AttributeError:
			logging.debug("FirefoxProcess.firesharkDoneLoop is NOT running")
		
		try:
			if self.tryToKillFirefoxLoop.running:
				logging.debug("FirefoxProcess.tryToKillFirefoxLoop IS running.")
			else:
				logging.debug("FirefoxProcess.tryToKillFirefoxLoop is NOT running. starting...")
				self.tryToKillFirefoxLoop = LoopingCall(self.killIfAlive)
				self.tryToKillFirefoxLoop.start(0.5, now= True)
		except AttributeError:
			logging.debug("FirefoxProcess.tryToKillFirefoxLoop does not exist. starting...")
			self.tryToKillFirefoxLoop = LoopingCall(self.killIfAlive)
			self.tryToKillFirefoxLoop.start(0.5, now=True)


	def __init__(self, firesharkProtocol, profile, params):

		self.processTimedOut = False
		self.dirtyExitCalled = False

		self.firesharkProtocol = firesharkProtocol
		self.profile = profile
		self.params = params

		self.doneFileFound = False

		self.checkFiresharkReadyLoopCount = 0
		self.checkFiresharkDoneLoopCount = 0

		self.username = pwd.getpwuid( os.getuid() )[0]
		self.profile_dir = profile['profile_dir']
		self.fireshark_home_dir = os.getenv("HOME") 
		self.fireshark_profile_dir = self.fireshark_home_dir + "/.mozilla/firefox/" + self.profile_dir

	def init_firefox_files(self):

		# delete any files from previous fireshark session
		files = ["sessionstore.js", "sessionstore.bak", "firesharkReady",
				 "firesharkDone", "firesharkURLs", "events.js", 
				 "reportlog.txt"]

		for file in files:
			absfile = self.fireshark_profile_dir + "/" + file
			if os.path.isfile(absfile):
				try:
					os.unlink(absfile)
				except (OSError, IOError):
					pass

	def run(self):

		logging.debug("FirefoxProcess::run called")

		logging.debug("FirefoxProcess::run intialize firefox files")

		self.init_firefox_files()

		# write params to file for fireshark to read from
		absfile = self.fireshark_profile_dir + "/firesharkURLs"
		try:
			f = open(absfile, 'w')
			f.write(simplejson.dumps(self.params))
			f.close()
		except IOError:
			logging.debug("path for firesharkURLs does not exist: %s", absfile)
			# TODO: return some sort of failure at this point

		profile_id = self.profile['name']

		command = "xvfb-run --auto-servernum firefox -P %s" % profile_id
   		logging.debug("command: %s", command)
   		args = shlex.split(command)

		self.processProtocol = TimedProcessProtocol(self, self.firesharkProtocol, 100)
		subprocess = reactor.spawnProcess(self.processProtocol, args[0], args, env = os.environ, usePTY=1)
		logging.debug("FirefoxProcess::run spawned a process: pid: %d", subprocess.pid)
		self.pid = subprocess.pid

		lc = LoopingCall(self.checkFiresharkReady)
		self.firesharkReadyLoop = lc
		lc.start(0.5, now=True)

	def checkIfKilled(self):

		logging.debug("FirefoxProcess::checkIfKilled called")

		try:
			os.kill(self.pid, 0)
		except OSError, err:
			if err.errno == errno.ESRCH:
				logging.debug("FirefoxProcess::checkIfKilled process is NOT running")
			elif err.errno == errno.EPERM:
				logging.debug("FirefoxProcess::checkIfKilled No permission to signal this process!")
			else:
				logging.debug("FirefoxProcess::checkIfKilled unknown error")
		else:
			logging.debug("FirefoxProcess::checkIfKilled process IS running")

	def checkIfFirefoxWasKilled(self):
		logging.debug("FirefoxProcess::checkIfFirefoxWasKilled called")
	
		if self.processProtocol.isProcessDead():
			logging.debug("FirefoxProcess::checkIfFirefoxWasKilled returning True")
			return True
		else:
			logging.debug("FirefoxProcess::checkIfFirefoxWasKilled returning False")
			return False

	def killIfAlive(self):

		logging.debug("FirefoxProcess::killIfAlive called")

		logging.debug("FirefoxProcess::killIfAlive trying to kill pid: %d" % self.pid)
		
		try:
			self.processProtocol.killProcessIfAlive()
		except AttributeError:
			try:
				if self.tryToKillFirefoxLoop.running:
					self.tryToKillFirefoxLoop.stop()
					logging.debug("FirefoxProcess::killIfAlive tryToKillFirefoxLoop stopped")
			except AttributeError:
				pass

		try:
			os.kill(self.pid, 0)
		except OSError, err:
			if err.errno == errno.ESRCH:
				logging.debug("FirefoxProcess::killIfAlive process is NOT running")
				if self.tryToKillFirefoxLoop.running:
					self.tryToKillFirefoxLoop.stop()
					logging.debug("FirefoxProcess::killIfAlive tryToKillFirefoxLoop stopped")
			elif err.errno == errno.EPERM:
				logging.debug("FirefoxProcess::killIfAlive No permission to signal this process!")
			else:
				logging.debug("FirefoxProcess::killIfAlive unknown error")
		else:
			logging.debug("FirefoxProcess::killIfAlive process IS running")

	def checkFiresharkReady(self):

		self.checkFiresharkReadyLoopCount+=1
		logging.debug("FirefoxProcess::checkFiresharkReady called %d" % self.checkFiresharkReadyLoopCount)

		if os.path.exists(self.fireshark_profile_dir + "/firesharkReady"):
			logging.debug("\tFirefoxProcess::checkFiresharkReady firesharkReady file found")
			if self.firesharkReadyLoop.running:
				self.firesharkReadyLoop.stop()
				logging.debug("FirefoxProcess::checkFiresharkReady firesharkReadyLoop stopped")

			self.firesharkDoneLoop = LoopingCall(self.checkFiresharkDone)
			self.firesharkDoneLoop.start(0.5, now=True)

	def checkFiresharkDone(self):
		self.checkFiresharkDoneLoopCount+=1
		logging.debug("FirefoxProcess::checkFiresharkDone called %d" % self.checkFiresharkDoneLoopCount)
		if os.path.exists(self.fireshark_profile_dir + "/firesharkDone"):
			logging.debug("\tFirefoxProcess::checkFiresharkDone firesharkDone file found")
			if self.firesharkDoneLoop.running:
				self.firesharkDoneLoop.stop()
				logging.debug("FirefoxProcess::checkFiresharkDone firesharkDoneLoop stopped")
				self.doneFileFound = True

			logging.debug("FirefoxProcess::checkFiresharkDone calling tryToKillFirefox in a loop")
			self.tryToKillFirefoxLoop = LoopingCall(self.killIfAlive)
			self.tryToKillFirefoxLoop.start(0.5, now=True)

	def checkIfEventsFileExists(self):

		if self.processTimedOut == True:
			self.dirtyExit()
			self.events = []
			event = {}
			event['eventType'] = "serviceTimeout"
			self.events.append(event)

			eventsFile = self.fireshark_profile_dir + "/events.js"

			if os.path.exists(eventsFile):
				f = open(eventsFile, 'r')
				for line in iter(f):
					eventstr = line
					event = {}
					event = simplejson.loads( eventstr )
					if event.has_key('eventType'):
						self.events.append(event)
				f.close()

			return self.events

		if self.dirtyExitCalled == True:
			self.dirtyExit()
			self.events = []
			event = {}
			event['eventType'] = "serviceExit"
			self.events.append(event)
			
                        if os.path.exists(eventsFile):
                                f = open(eventsFile, 'r')
                                for line in iter(f):
                                        eventstr = line
                                        event = {}
                                        event = simplejson.loads( eventstr )
                                        if event.has_key('eventType'):
                                                self.events.append(event)
                                f.close()

			return self.events

		if self.doneFileFound == False:
			return None

		eventsFile = self.fireshark_profile_dir + "/events.js"

		if os.path.exists(eventsFile):
			self.events = []
			f = open(eventsFile, 'r')
			for line in iter(f):
				eventstr = line
				event = {}
				event = simplejson.loads( eventstr )
				if event.has_key('eventType'):
					self.events.append(event)
			f.close()
			return self.events
		else:
			return None
