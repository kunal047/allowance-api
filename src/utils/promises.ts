export const unpackResult = async (promise: Promise<any>) => (await promise)[0];

export const convertString = async (promise: Promise<any>) =>
  String(await promise);
