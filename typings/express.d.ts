export {};

declare global {
  namespace Express {
    interface Request {
      userInput: UserInput;
    }
  }
}
