# = Nginx Log Adapter for MongoDB
# by Mike Green
#
# Listens for input on a named pipe, which Nginx sends it log output to (instead of a standard file).
# Parses the log output and sends it on to a MongoDB server for storage, which need not live on the
# same machine.

# Libraries
fs             = require 'fs'
path           = require 'path'
carrier        = require 'carrier'
{ Db }         = require 'mongodb'
{ Connection } = require 'mongodb'
{ Server }     = require 'mongodb'
{ spawn }      = require 'child_process'

# Runtime configuration
pipe             = process.argv[2]
mongo_collection = process.argv[3]
mongo_db         = 'nginx_logs'
mongo_host       = if process.argv[4] then process.argv[4] else "127.0.0.1"
mongo_port       = if process.argv[5] then process.argv[5] else "27017"
verbose          = false

if process.argv.length < 4
	script_name = 
	console.log "# = Nginx MongoDB Logger Daemon"
	console.log "Usage: #{path.basename process.argv[1]} log_file collection [mongo_host] [mongo_port]"
	process.exit()

fs.stat pipe, (err, stat) ->
	console.log "Opening named pipe #{pipe} for reading..." if verbose
	
	throw err if err
	unless mongo_db
		console.log "Please name a MongoDB database to log to!"
		process.exit 1

	console.log "Connecting to MongoDB database..." if verbose
	server = new Server mongo_host, mongo_port, { auto_reconnect: true }, {}
	db = new Db mongo_db, server

	db.open (err, db) ->
		# Open the log_stream collection for writing
		db.collection mongo_collection, (err, coll) ->
			throw err if err

			tail = spawn 'tail', [ '-f', pipe ]
			log_regexp = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\ \-\ (.+)\ \[(.+)\]\ \"(\w+)\ (.+)\ HTTP\/(\d\.\d)\"\ (\d{3})\ (.+)\ \"(.+)\"\ \"(.+)\"$/

			carrier.carry tail.stdout, (line) ->
				# Listen for log input lines and process them here
				matches = line.match log_regexp

				if matches and matches.length > 0
					status_code = parseInt matches[7], 10 if matches[7]
					size = parseInt matches[8], 10 if matches[8]
					attrs = 
						facility: 'nginx'
						date: new Date()
						remote_ip: matches[1]
						username: matches[2]
						method: matches[4]
						path: matches[5]
						http_version: matches[6]
						status: if status_code then status_code else matches[7]
						size: if size then size else matches[8]
						parent: matches[9]
						user_agent: matches[10]

					coll.insert attrs, (res) ->
						console.log res if verbose

				else
					console.log "No Matches!" if verbose
