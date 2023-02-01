export type Logger = {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

type Severity = "debug" | "warn" | "error";

export class DefaultLogger implements Logger {
  private severity: Severity;
  constructor(debugMode: Severity = "debug") {
    this.severity = debugMode;
  }

  log(args: any[]) {
    console.log(this.format(args));
  }

  warn(args: any[]) {
    if (this.severity != "error") {
      console.warn(this.format(args));
    }
  }

  error(args: any[]) {
    if (this.severity === "error") {
      console.error(this.format(args));
    }
  }

  private format(...args: any[]) {
    return `### ${new Date()} ${args}`;
  }
}
