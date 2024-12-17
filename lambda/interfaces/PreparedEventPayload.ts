export type PreparedEventPayload<T> = {
  data: T;
  meta: {
    incoming?: {
      account: string;
      source: string;
      detailType: string;
    };
    outgoing: {
      source: string;
      detailType: string;
    };
    fn: string;
  };
};