declare module "mammoth/mammoth.browser" {
  interface ExtractRawTextResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  interface ExtractRawTextInput {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    extractRawText(input: ExtractRawTextInput): Promise<ExtractRawTextResult>;
  };
  export default mammoth;
}
