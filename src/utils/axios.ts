import axios from 'axios';

export const rpcRequest = async (url, data) => {
  const response = await axios.post(
    url,
    data,
  );
  return response;
};
