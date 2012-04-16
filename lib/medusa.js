/*
 * Medusa.js: A fixed-length Redis transport and Log server for Winston
 *
 * (C) 2011, Charlie Robbins
 * (C) 2012, Dov Amihod
 */

var redis = require('redis'),
    winston = require('winston'),
    common = require('winston/lib/winston/common'),
    util = require('util');
    
var Medusa = exports.Medusa = function (options) {
  var self = this;

  var loggerPrefix = 'Logger:';
  var containerPrefix = 'Logs:';

  options       = options || {};
  options.host  = options.host || 'localhost';
  options.port  = options.port || 6379;
  options.debug = options.debug || false;

  this.name      = 'redis';
  this.redis     = redis.createClient(options.port, options.host);
  this.pubRedis     = redis.createClient(options.port, options.host);

  this.json      = options.json      || false;

  //////////////////////////////////////////////
  // we will limit the log list to this value
  this.length    = options.length    || 5000;

  this.class            = options.class     || ''
  this.title            = options.title     || process.title + '-' + process.pid;
  this.persist          = options.persist   || true;
  this.interval         = 0;

  this.container        = containerPrefix + this.title;
  this.globalContainer  = options.globalContainer || 'Logs:All';

  this.timestamp = options.timestamp || true;

  ////////////////////////////////////////////////////////
  // we will register our selves with the redis DB - this should be
  // on a degrading timer, which we will refresh as long as we are alive
  // we will set up an interval which will let the server know that we're here.

  ////////////////////////////////////////////////////////
  // when we post we need to post to our custom channel

  ///////////////////////////////////////////////////////
  // and to the global channel

  ////////////////////////////////////////////////////////
  // if we're persisting, then we need to write to the DB

  ////////////////////////////////////////////////////////
  // that's it.

  ///////////////////////////////////////////////////////
  // if we fail, or can't connect, them tempis -

  if (options.auth) {
    this.redis.auth(options.auth);
  }
  
  // Suppress errors from the Redis client
  this.redis.on('error', function (err) { 
    self.emit('error');
  });

  this.redis.on('connect', function (err) {

    var key =loggerPrefix+self.title;

    // add our name to the global hash, with expiration
    self.redis.set([key,1], function(err){

      var setExpire = function(){
        //set the expiration
        self.redis.expire([key,10], function(){});
      };
      self.interval = setInterval(setExpire,7000);
    });
    //

  });

  this.redis.on('disconnect', function (err) {

    // kill the interval
    if (self.interval){
      clearInterval(self.interval);
      self.interval = 0;
    }
  });

  return this;

};  

//
// Inherit from `winston.Transport`.
//
util.inherits(Medusa, winston.Transport);

//
// Define a getter so that `winston.transports.Redis` 
// is available and thus backwards compatible.
//
winston.transports.Medusa = Medusa;

//
// ### function log (level, msg, [meta], callback)
// Core logging method exposed to Winston. Metadata is optional.
//
Medusa.prototype.log = function (level, msg, meta, callback) {
  var self = this;

  var output = JSON.stringify({level:level,
    title:this.title,
    class:this.class,
    msg:msg,
    data: meta,
    timestamp: Date.parse(new Date())});

  //PUBLISH channel message
  //Post a message to a channel

  if (this.persist){

    ////////////////////////////////////////
    // save to the DB's

    // save to my list
    self.redis.lpush(self.container, output, function (err,listLen) {
      if (err) {
        return self.emit('error', err);
      }

      if (listLen > self.length){
        self.redis.ltrim(self.container, 0, self.length, function () {
          if (err) {
            return self.emit('error', err);
          }
          self.emit('logged');
        });
      }else{
        self.emit('logged');
      }
    });

    // save to the global list
    if (self.globalContainer != ''){
      self.redis.lpush(self.container, output, function (err) {
        if (err) {
          return self.emit('error', err);
        }

        self.emit('globalLogged');
      });
    }
  }

  /////////////////////////////////////////////////////
  // done with the loggin, so publish
  self.pubRedis.publish([this.title,output]);

  callback(null, true);
};