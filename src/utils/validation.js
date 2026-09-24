const invalidateCache = async (redisClient, key) => {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }
};

module.exports = { invalidateCache };
