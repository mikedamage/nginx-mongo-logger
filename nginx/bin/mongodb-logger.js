(function() {
  var Connection, Db, Server, carrier, fs, mongo_db, mongo_host, mongo_port, pipe, spawn, verbose;
  fs = require('fs');
  carrier = require('carrier');
  Db = require('mongodb').Db;
  Connection = require('mongodb').Connection;
  Server = require('mongodb').Server;
  spawn = require('child_process').spawn;
  pipe = process.argv[2];
  mongo_db = process.argv[3];
  mongo_host = process.argv[4] ? process.argv[4] : "127.0.0.1";
  mongo_port = process.argv[5] ? process.argv[5] : "27017";
  verbose = true;
  fs.stat(pipe, function(err, stat) {
    var db, server;
    if (verbose) {
      console.log("Opening named pipe " + pipe + " for reading...");
    }
    if (err) {
      throw err;
    }
    if (!mongo_db) {
      console.log("Please name a MongoDB database to log to!");
      process.exit(1);
    }
    if (verbose) {
      console.log("Connecting to MongoDB database...");
    }
    server = new Server(mongo_host);
    db = new Db(mongo_db, server);
    return db.collection('log_stream', function(err, collection) {
      var log_regexp, tail;
      if (err) {
        throw err;
      }
      tail = spawn('tail', ['-f', pipe]);
      log_regexp = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\ \-\ (.+)\ \[(.+)\]\ \"(\w+)\ (.+)\ HTTP\/(\d\.\d)\"\ (\d{3})\ (.+)\ \"(.+)\"\ \"(.+)\"$/;
      carrier.carry(tail.stdout, function(line) {
        var match_num, matches;
        matches = line.match(log_regexp);
        if (matches && matches.length > 0) {
          match_num = 0;
          return matches.forEach(function(m) {
            console.log("" + match_num + ":\t" + m);
            return match_num++;
          });
        } else {
          return console.log("No Matches!");
        }
      });
      return process.on('SIGINT', function() {
        if (verbose) {
          console.log('Killing tail process and exiting');
        }
        return tail.kill('SIGTERM');
      });
    });
  });
}).call(this);
