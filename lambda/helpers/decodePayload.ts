export const decodePossiblyLargePayload = async ({
  payload,
}: {
  payload: any;
}) => {
  try {
    if (payload?.presignedUrl) {
      const response = await fetch(payload.presignedUrl);
      const raw = await response.text();
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error(e);
  }
  return { ...payload };
};
