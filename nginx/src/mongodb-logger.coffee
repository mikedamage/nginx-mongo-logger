# = Nginx Log Adapter for MongoDB
# by Mike Green
#
# Listens for input on a named pipe, which Nginx sends it log output to (instead of a standard file).
# Parses the log output and sends it on to a MongoDB server for storage, which need not live on the
# same machine.

# Libraries
fs             = require 'fs'
{ Db }         = require 'mongodb'
{ Connection } = require 'mongodb'
{ Server }     = require 'mongodb'
carrier        = require 'carrier'

# Runtime configuration
pipe           = process.argv[2]
mongo_db       = process.argv[3]
mongo_host     = if process.argv[4] then process.argv[4] else "127.0.0.1"
mongo_port     = if process.argv[5] then process.argv[5] else "27017"
verbose        = true

fs.stat pipe, (err, stat) ->
	console.log "Opening named pipe #{pipe} for reading..." if verbose
	
	throw err if err
	unless mongo_db
		console.log "Please name a MongoDB database to log to!"
		process.exit 1

	console.log "Connecting to MongoDB database..." if verbose
	server = new Server mongo_host
	db = new Db mongo_db, server

	# Open the log_stream collection for writing
	db.collection 'log_stream', (err, collection) ->
		throw err if err

		fifo = fs.createReadStream pipe
		log_regexp = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\ \-\ (.+)\ \[(.+)\]\ \"(\w+)\ (.+)\ HTTP\/(\d\.\d)\"\ (\d{3})\ (.+)\ \"(.+)\"\ \"(.+)\"$/

		carrier.carry fifo, (line) ->
			# Listen for log input lines and process them here
			matches = line.match log_regexp

			if matches and matches.length > 0
				match_num = 0
				matches.forEach (m) ->
					console.log "#{match_num}:\t#{m}"
					match_num++
			else
				console.log "No Matches!"
			
