import React from 'react';
import Select from 'react-select';
import { useSearchState } from '../searchStateContext';
import useClickstreamMetadata from '../hooks/useClickstreamMetadata';
import { normalize } from '../utils';

const LanguageSearch = ({ name }) => {
  const [{ language, title }, onChange] = useSearchState();
  const { data: metadata } = useClickstreamMetadata();
  const { languages } = metadata ?? {};
  const options = languages && [
    ...languages.filter(({ value }) => value === language),
    ...languages.filter(({ value }) => value !== language),
  ];

  const handleLanguageChange = async (newLanguage) => {
    try {
      const encodedTitle = encodeURIComponent(title);
      const url = `https://${language}.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=langlinks&format=json&formatversion=2&lllang=${newLanguage}&origin=*`;
      const response = await fetch(url);
      const data = await response.json();
      const translatedTitle = data.query?.pages?.[0]?.langlinks?.[0]?.title;

      if (translatedTitle) {
        onChange({ language: newLanguage, title: normalize(translatedTitle) });
      } else {
        onChange(name, newLanguage);
      }
    } catch {
      onChange(name, newLanguage);
    }
  };

  return (
    <Select
      placeholder={`${language}.wikipedia.org`}
      value={options?.find(({ value }) => value === language)}
      cacheOptions
      onChange={(option) => handleLanguageChange(option.value)}
      defaultValue={options?.[0]}
      options={options}
      noOptionsMessage={() => null}
      components={{
        DropdownIndicator: () => null,
        IndicatorSeparator: () => null,
      }}
      maxMenuHeight={175}
      theme={(theme) => ({
        ...theme,
        colors: {
          ...theme.colors,
          neutral50: 'black',
        },
      })}
    />
  );
};

export default LanguageSearch;
