export type Emission = Readonly<{
  code: string;
  parent?: string;
  subject: string;
}>;

export type EmissionConsumer = (emission: Emission) => Promise<void>;

export type EmissionConsumerRegistration = Readonly<{
  consumerId: string;
  codes: readonly string[];
  receive: EmissionConsumer;
}>;
