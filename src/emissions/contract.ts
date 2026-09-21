export type Emission = Readonly<{
  code: string;
  parent?: string;
  subject: string;
}>;

export type EmissionConsumer = (emission: Emission) => Promise<void>;
