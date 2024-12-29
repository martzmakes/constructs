import { Context } from "aws-lambda";
import { getTracer } from "../clients/tracer";

type Handler = (event: any, context: Context) => Promise<any>;

const tracer = getTracer();

export const initHandler = ({
  handler,
  errorOutput,
}: {
  handler: Handler;
  errorOutput?: any;
}) => {
  return async (event: any, context: Context) => {
    console.log(JSON.stringify(event, null, 2));
    const segment = tracer.getSegment(); // This is the facade segment (the one that is created by AWS Lambda)
    let subsegment;
    if (segment) {
      // Create subsegment for the function & set it as active
      subsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
      tracer.setSegment(subsegment);
    }
    tracer.annotateColdStart();
    tracer.addServiceNameAnnotation();
    let handlerOutput;
    try {
      handlerOutput = await handler(event, context);
      tracer.addResponseAsMetadata(handlerOutput, process.env._HANDLER);
    } catch (err) {
      tracer.addErrorAsMetadata(err as Error);
      throw err;
    } finally {
      if (segment && subsegment) {
        subsegment.close();
        tracer.setSegment(segment);
      }
    }
    return handlerOutput || errorOutput;
  };
};
