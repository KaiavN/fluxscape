export class ReActCommand {
  constructor(public type: string, public args: string[]) {}
}

export class ReActCommandLexer {
  private _position = 0;
  private _commands: ReActCommand[] = [];
  private _buffer = '';

  public get commands(): readonly ReActCommand[] {
    return this._commands;
  }

  private peek(input: string): string {
    if (this._position < input.length) {
      return input[this._position];
    }
    return '';
  }

  private next(input: string): string {
    const ch = input[this._position];
    this._position++;
    return ch;
  }

  private readUntil(input: string, stopChars: string[]): string {
    let value = '';
    let escaped = false;
    while (this._position < input.length) {
      const ch = this.peek(input);
      if (ch === '\n') {
        value += ch;
        this.next(input);
      } else if (stopChars.includes(ch) && !escaped) {
        break;
      } else if (ch === '\\' && !escaped) {
        escaped = true;
        this.next(input);
      } else {
        escaped = false;
        value += this.next(input);
      }
    }
    return value.trim();
  }

  public append(ch: string): ReActCommand[] {
    this._buffer += ch;
    const previousCommands = this._commands.slice(); // shallow copy
    const previousCount = previousCommands.length;
    
    this.tokenize(this._buffer);
    
    const changedCommands: ReActCommand[] = [];
    
    // Check for new commands
    if (this.commands.length > previousCount) {
      changedCommands.push(...this.commands.slice(previousCount));
    }
    
    // Check for changed content in existing commands
    const checkLength = Math.min(previousCount, this.commands.length);
    for (let i = 0; i < checkLength; i++) {
      if (this.hasCommandChanged(previousCommands[i], this.commands[i])) {
        changedCommands.push(this.commands[i]);
      }
    }
    
    return changedCommands;
  }

  /**
   * Check if command content has changed
   */
  private hasCommandChanged(oldCmd: ReActCommand, newCmd: ReActCommand): boolean {
    if (oldCmd.type !== newCmd.type) return true;
    if (oldCmd.args.length !== newCmd.args.length) return true;
    for (let i = 0; i < oldCmd.args.length; i++) {
      if (oldCmd.args[i] !== newCmd.args[i]) return true;
    }
    return false;
  }

  public tokenize(input: string): ReActCommand[] {
    this._position = 0;
    this._commands = [];

    while (this._position < input.length) {
      const uppercaseRegex = /[A-Z]/;
      while (this._position < input.length && !uppercaseRegex.test(this.peek(input))) {
        this.next(input);
      }

      const value = this.readUntil(input, ['[']);
      const commandType = value.trim();

      const args: string[] = [];
      if (this.peek(input) === '[') {
        this.next(input);
      }

      while (this.peek(input) !== ']') {
        if (this._position >= input.length) {
          break;
        }

        if (this.peek(input) === '"') {
          this.next(input);
          const arg = this.readUntil(input, ['"']);
          args.push(arg);
          this.next(input);
        } else {
          this.next(input);
        }
      }

      if (this.peek(input) === ']') {
        this.next(input);
        if (commandType !== '' && /^[A-Z]/.test(commandType)) {
          this._commands.push(new ReActCommand(commandType, args));
        }
      } else {
        if (this._commands.length > 0) {
          const lastCommand = this._commands[this._commands.length - 1];
          lastCommand.type = commandType;
          lastCommand.args = args;
        }
      }
    }

    return this._commands;
  }
}
