import { createContext, useContext } from 'react';
import { Repository } from './repository';
import { mockRepository } from './mockRepository';

export const RepositoryContext = createContext<Repository>(mockRepository);

export const useRepo = (): Repository => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepo must be used within a RepositoryProvider');
  }
  return context;
};
