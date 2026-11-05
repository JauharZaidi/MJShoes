import redis from './redis.js';

export class CircuitBreaker {
  constructor(name, threshold = 5, resetTimeoutMs = 30000) {
    this.name = `breaker:${name}`;
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  async getState() {
    const data = await redis.hgetall(this.name);
    if (!data.state) return { state: 'CLOSED', failures: 0, nextAttempt: 0 };
    return {
      state: data.state,
      failures: parseInt(data.failures, 10),
      nextAttempt: parseInt(data.nextAttempt, 10)
    };
  }

  async fire(action) {
    const current = await this.getState();

    if (current.state === 'HALF_OPEN') {
      // Another request already won the right to probe — everyone else fast-fails
      // until that probe resolves (success()/fail() below moves state on).
      throw new Error(`CircuitBreaker [${this.name}] is HALF_OPEN — a probe request is already in flight.`);
    }

    if (current.state === 'OPEN') {
      if (Date.now() <= current.nextAttempt) {
        throw new Error(`CircuitBreaker [${this.name}] is OPEN. Fast failing request.`);
      }
      // Recovery window has passed — only one concurrent caller should get to send
      // the single probe request; an NX lock picks exactly one winner instead of
      // every queued request re-probing the downstream service simultaneously.
      const wonProbe = await redis.set(`${this.name}:probe_lock`, '1', 'NX', 'PX', this.resetTimeoutMs);
      if (!wonProbe) {
        throw new Error(`CircuitBreaker [${this.name}] is OPEN. Fast failing request (probe already claimed).`);
      }
      await redis.hset(this.name, 'state', 'HALF_OPEN');
    }

    try {
      const result = await action();
      await this.success();
      return result;
    } catch (err) {
      await this.fail(current);
      throw err;
    }
  }

  async success() {
    await redis.hset(this.name, { state: 'CLOSED', failures: 0, nextAttempt: 0 });
    await redis.del(`${this.name}:probe_lock`);
  }

  async fail(current) {
    if (!current) {
      current = await this.getState();
    }
    // Atomic increment — reading `current.failures` and writing `+1` back would lose
    // updates when multiple requests fail concurrently.
    const newFailures = await redis.hincrby(this.name, 'failures', 1);

    if (newFailures >= this.threshold) {
      await redis.hset(this.name, {
        state: 'OPEN',
        nextAttempt: Date.now() + this.resetTimeoutMs
      });
      console.warn(`🚨 Distributed CircuitBreaker [${this.name}] TRIPPED OPEN! Recovery window: ${this.resetTimeoutMs}ms`);
    } else if (current.state === 'HALF_OPEN') {
      await redis.hset(this.name, {
        state: 'OPEN',
        nextAttempt: Date.now() + this.resetTimeoutMs
      });
      console.warn(`🚨 Distributed CircuitBreaker [${this.name}] TRIPPED OPEN from HALF_OPEN.`);
    }
  }
}
