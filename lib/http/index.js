
/*!
 * q - http
 * Copyright (c) 2011 LearnBoost <tj@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
var nullfn = function(){};

var  path=require('path')
   , config = require(path.join('..','..','config','config'))
   , express = require('express');

// setup

var app = express.createServer()
  , util = require('util')
  , io = require('socket.io').listen(app, {'log level':0});


// expose the app

module.exports = app;

// config

app.set('view options', { doctype: 'html' });
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.set('title', 'Medusa');
app.helpers({ inspect: util.inspect });

// middleware

app.use(express.favicon());
app.use(app.router);
app.use(express.static(__dirname + '/public'));

var self = app;

var rc;
var rcPub;

var loggers = {};

///////////////////////////////////////////
// setup socket.io to send log messages to
// everyone connected
var newlog = function(channel,data){

  //console.log('log  -- ' + channel);

  // let everyone know.
  io.sockets.in(channel).emit('log', JSON.parse(data));
  //io.sockets.emit('log', JSON.parse(data));
  //io.sockets.in(

};

// this function will poll the redit db to get all the connected logging instances
// it will then update its subscription and push the list of loggers to the website
// we need to resolve add and removed, so we will push two events
// loggers:new
// loggers:removed
var updateLoggers = function(){

  var loggerTest = {};
  var newLoggers = {};
  var removedLoggers = {};

  var newLoggers_length = 0;
  var removedLoggers_length = 0;
  //////////////////////////////////////////
  if (rc ){

    // get the list of loggers
    rc.keys(['Logger:*'],function(err,res){

      var len = res.length;
      for(var itr = 0 ; itr < len; itr ++){
        var name = res[itr].split(':')[1];
        if (!(name in loggers)){
          newLoggers[name] = 1;
          newLoggers_length++;
        }
        loggerTest[name] = 1;
      }

      ////////////////////////////////////
      // now go through the existing loggers.
      // remove the ones that are not in the loggerTest
      // object
      for (var itrLog in loggers){
        if (!(itrLog in loggerTest)){
          // its been removed,
          removedLoggers[itrLog] = 1;
          removedLoggers_length ++;
          delete loggers[itrLog];
        }
      }

      // now we can register for the new loggers, and unregister for
      // the older ones.
      if (rcPub){

        ///////////////////////////
        // add the new ones
        for (var itr in newLoggers){
          loggers[itr] = 1;
          rcPub.subscribe([itr],function(err,res){

          });
        }

        // unsub for the old ones,
        // sub for the new ones
        for (var itr in removedLoggers){
          rcPub.unsubscribe([itr],function(err,res){
          });
        }
      }

      //////////////////////////////////////////
      // finally let our clients know
      if (newLoggers_length){
        io.sockets.emit('loggers:new', newLoggers);
      }

      if (removedLoggers_length){
        io.sockets.emit('loggers:removed', removedLoggers);
      }
    });
  }
};

app.init = function(params, cb){

  cb = cb || nullfn;

  ///////////////////////////////////////////////
  // create the redis connection
  // connect to the DB
  try {
    // Redis configuration settings
    var redisConfig = {
      port   :params.port || 6379,
      host   :params.host || '127.0.0.1',
      options:{
        return_buffer:false
      }
    };


    var Redis = require('redis');
    var db = Redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
    db.max_attempts = 1;

    var onError = function (err) {
      cb(new Error('Could not connect to Redis'), null);
    };

    var onConnect = function () {

      ////////////////////////////////////////
      // set up the routes
      /*app.get('/stats', provides('json'), json.stats);
      app.get('/job/search', provides('json'), json.search);
      app.get('/jobs/:from..:to/:order?', provides('json'), json.jobRange);
      app.get('/jobs/:type/:state/:from..:to/:order?', provides('json'), json.jobTypeRange);
      app.get('/jobs/:state/:from..:to/:order?', provides('json'), json.jobStateRange);
      app.get('/job/types', provides('json'), json.types);
      app.get('/job/:id', provides('json'), json.job);
      app.get('/job/:id/log', provides('json'), json.log);
      app.put('/job/:id/state/:state', provides('json'), json.updateState);
      app.put('/job/:id/priority/:priority', provides('json'), json.updatePriority);
      app.del('/job/:id', provides('json'), json.remove);*/

      app.get('/', function (req, res) {
        res.render('index.jade');
      });

      rc = db;

      // call the first update logger
      updateLoggers();


      cb(null, db);

    };

    db.on('error', onError);
    db.on("connect", onConnect);

    /////////////////////////////////////////////////////
    // Also set up the pub/sub
    var dbPubSub = Redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);
    dbPubSub.max_attempts = 1;
    dbPubSub.on('error', function (err) {
      /////////////////////////////////
    });

    dbPubSub.on('connect', function () {

      rcPub = dbPubSub;

      dbPubSub.on('message', newlog);

      updateLoggers();
    });

  } catch (err) {
    cb(new Error('Redis unavailable'), null);
  }

  ////////////////////////////////////
  // init the connections
  io.sockets.on('connection', function (socket) {

    // when a new socket connects, bring them up to date
    socket.emit('loggers:new', loggers);


    ////////////////////////////////////
    // init the connections
    socket.on('loggers:sub', function (data,cb) {

      cb = cb || nullfn;
      for (var itr in data){
        socket.join(itr);
        //console.log('join  -- ' + itr);
      }
      cb();
    });

    ////////////////////////////////////
    // init the connections
    socket.on('loggers:unsub', function (data,cb) {
      cb = cb || nullfn;

      for (var itr in data){
        socket.leave(itr);
        //console.log('leave -- ' + itr);
      }

      cb();
    });

  });

  setInterval(updateLoggers, config.loggerInterval);

};
