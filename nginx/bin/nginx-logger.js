(function() {
  var Connection, Db, Server, carrier, fs, mongo_collection, mongo_db, mongo_host, mongo_port, path, pipe, script_name, spawn, verbose;
  fs = require('fs');
  path = require('path');
  carrier = require('carrier');
  Db = require('mongodb').Db;
  Connection = require('mongodb').Connection;
  Server = require('mongodb').Server;
  spawn = require('child_process').spawn;
  pipe = process.argv[2];
  mongo_collection = process.argv[3];
  mongo_db = 'nginx_logs';
  mongo_host = process.argv[4] ? process.argv[4] : "127.0.0.1";
  mongo_port = process.argv[5] ? process.argv[5] : "27017";
  verbose = false;
  if (process.argv.length < 4) {
    script_name = console.log("# = Nginx MongoDB Logger Daemon");
    console.log("Usage: " + (path.basename(process.argv[1])) + " log_file collection [mongo_host] [mongo_port]");
    process.exit();
  }
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
    server = new Server(mongo_host, mongo_port, {
      auto_reconnect: true
    }, {});
    db = new Db(mongo_db, server);
    return db.open(function(err, db) {
      return db.collection(mongo_collection, function(err, coll) {
        var log_regexp, tail;
        if (err) {
          throw err;
        }
        tail = spawn('tail', ['-f', pipe]);
        log_regexp = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\ \-\ (.+)\ \[(.+)\]\ \"(\w+)\ (.+)\ HTTP\/(\d\.\d)\"\ (\d{3})\ (.+)\ \"(.+)\"\ \"(.+)\"$/;
        return carrier.carry(tail.stdout, function(line) {
          var attrs, matches;
          matches = line.match(log_regexp);
          if (matches && matches.length > 0) {
            attrs = {
              facility: 'nginx',
              date: new Date(),
              remote_ip: matches[1],
              username: matches[2],
              method: matches[4],
              path: matches[5],
              http_version: matches[6],
              status: matches[7],
              size: matches[8],
              parent: matches[9],
              user_agent: matches[10]
            };
            return coll.insert(attrs, function(res) {
              if (verbose) {
                return console.log(res);
              }
            });
          } else {
            if (verbose) {
              return console.log("No Matches!");
            }
          }
        });
      });
    });
  });
}).call(this);
