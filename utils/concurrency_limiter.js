/* concurrency_limiter.js
 * Object that limits number of concurrent jobs.
 */

var Q = require('q');

/**
 * Constructs a new ConcurrencyJob object.
 *
 * @param callback Function to call when this job runs. A callback to be called
 *                 when the job is *finished* is passed to this callback.
 */
var ConcurrencyJob = function(callback) {
  this._callback = callback;
};

/**
 * Constructs a new ConcurrencyLimiter object.
 *
 * @param max_concurrent Number of max amount of concurrent jobs to allow
 *                       at once.
 * @return ConcurrencyLimiter instance.
 */
var ConcurrencyLimiter = function(max_concurrent) {
  this._max_concurrent = max_concurrent;

  this._queue = [];
  this._num_running = 0;
};

/**
 * Removes and runs the oldest job in the queue if it can.
 *
 * @return Function to call when the new job is finished, if any job exists.
 */
ConcurrencyLimiter.prototype._nextJob = function() {
  if (this._num_running < this._max_concurrent && this._queue.length > 0) {
    return this._runJob(this._queue.shift());
  }

  return null;
};

/**
 * Runs a job in the current concurrencylimiter.
 *
 * @param job ConcurrencyJob to run.
 * @return Function to call when the job is done.
 */
ConcurrencyLimiter.prototype._runJob = function(job) {
  var _this = this;
  job._callback(function() {
    _this._num_running--;
    _this._nextJob();
  });

  this._num_running++;
};

/**
 * Returns a promise that resolves with a Deferred object when a new job can
 * run. This Deferred should be resolved or rejected when the new job is done.
 */
ConcurrencyLimiter.prototype.newJob = function() {
  var deferred = Q.defer();
  var job = new ConcurrencyJob(deferred.resolve);
  this._queue.push(job);
  this._nextJob();
  return deferred.promise;
};

module.exports = ConcurrencyLimiter;

