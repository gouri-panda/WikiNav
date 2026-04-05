import React, { useEffect, createContext, useContext } from 'react';
import { useQueryParams, StringParam, withDefault } from 'use-query-params';

const SearchStateContext = createContext();

export const SearchStateProvider = ({ children }) => {
  const [searchState, setSearchState] = useQueryParams({
    language: withDefault(StringParam, 'en'),
    title: withDefault(StringParam, 'Chocolate'),
  });

  useEffect(() => {
    setSearchState(searchState, 'replace');
  }, []);

  const handleSearchStateChange = (nameOrChanges, value) => {
    if (typeof nameOrChanges === 'object') {
      setSearchState(nameOrChanges, 'replaceIn');
    } else if (searchState[nameOrChanges] !== value) {
      setSearchState({ [nameOrChanges]: value }, 'replaceIn');
    }
  };
  const value = [searchState, handleSearchStateChange];

  return (
    <SearchStateContext.Provider value={value}>
      {children}
    </SearchStateContext.Provider>
  );
};

export const useSearchState = () => {
  const context = useContext(SearchStateContext);
  if (!context) {
    throw new Error('useSearchState requires a SearchStateContext to be set');
  }
  return context;
};
