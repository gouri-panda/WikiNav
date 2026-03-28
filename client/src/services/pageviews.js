import axios from 'axios';

const baseURL =
  'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';

const formatApiDate = (dateString) => dateString.replaceAll('-', '');

export const fetchMonthlyViews = async (language, title, month, year) => {
  const encodedTitle = encodeURIComponent(title);
  const url = `${baseURL}/${language}.wikipedia/all-access/user/${encodedTitle}/monthly/${year}010100/${year}123100`;
  const response = await axios.get(url);
  const allMonths = response.data.items;
  return allMonths && allMonths[parseInt(month, 10) - 1]?.views;
};

export const fetchDailyViews = async (language, title, startDate, endDate) => {
  const encodedTitle = encodeURIComponent(title);
  const start = `${formatApiDate(startDate)}00`;
  const end = `${formatApiDate(endDate)}00`;
  const url = `${baseURL}/${language}.wikipedia/all-access/user/${encodedTitle}/daily/${start}/${end}`;
  const response = await axios.get(url);
  return (
    response.data.items?.map(({ timestamp, views }) => ({
      date: `${timestamp.substring(0, 4)}-${timestamp.substring(
        4,
        6
      )}-${timestamp.substring(6, 8)}`,
      views,
    })) ?? []
  );
};

export default { fetchMonthlyViews, fetchDailyViews };
