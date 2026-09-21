import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage asynchronous fetching operations
 */
export const useFetch = (fetchFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      setError(err?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    let isMounted = true;
    fetchFunction()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch data');
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [fetchFunction]);

  return { data, loading, error, refetch: execute };
};

export default useFetch;
