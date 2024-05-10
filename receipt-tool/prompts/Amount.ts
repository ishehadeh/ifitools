import type { KeyCode } from "cliffy/keycode/key_code.ts";
import { GenericPrompt } from "cliffy/prompt/_generic_prompt.ts";
import {
  GenericSuggestions,
  GenericSuggestionsKeys,
  GenericSuggestionsOptions,
  GenericSuggestionsSettings,
} from "cliffy/prompt/_generic_suggestions.ts";

// @deno-types="https://raw.githubusercontent.com/MikeMcl/bignumber.js/v9.1.2/bignumber.d.ts"
import BigNumber from "bignumber";
import { bigNumberToIfxAmount } from "../util.ts";

type UnsupportedOptions = "files";

/** Amount prompt options. */
export interface AmountOptions
  extends
    Omit<GenericSuggestionsOptions<BigNumber, string>, UnsupportedOptions> {
  keys?: AmountKeys;
  decimalPlaces?: number;
}

/** Amount prompt settings (i.e. AmountOptions with default values added) */
interface AmountSettings extends GenericSuggestionsSettings<BigNumber, string> {
  keys?: AmountKeys;
  decimalPlaces: number;
}

/** Amount prompt keymap. */
export interface AmountKeys extends GenericSuggestionsKeys {
  /* clear the input: default: ['a'] */
  clear?: string[];
}

/**
 * Amount prompt representation.
 */
export class Amount extends GenericSuggestions<BigNumber, string> {
  protected readonly settings: AmountSettings;
  protected digits: string;
  protected sign: "+" | "-";

  /** Execute the prompt with provided message or options. */
  public static prompt(options: string | AmountOptions): Promise<BigNumber> {
    return new this(options).prompt();
  }

  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  public static inject(value: string): void {
    GenericPrompt.inject(value);
  }

  constructor(options: string | AmountOptions) {
    super();
    if (typeof options === "string") {
      options = { message: options };
    }
    this.settings = this.getDefaultSettings(options);
    this.sign = this.settings.default?.lt(0) != true ? "+" : "-";
    this.digits = this.settings.default?.multipliedBy(100).toFixed(
      0,
      BigNumber.ROUND_HALF_CEIL,
    ) ?? "";
  }

  public getDefaultSettings(options: AmountOptions): AmountSettings {
    const settings = super.getDefaultSettings(options);
    return {
      ...settings,
      files: false,
      decimalPlaces: 2,
      keys: {
        clear: ["a"],
        ...(settings.keys ?? {}),
      },
    };
  }

  protected success(value: BigNumber): string | undefined {
    this.saveSuggestions(value.toString());
    return super.success(value);
  }

  /**
   * Handle user input event.
   * @param event Key event.
   */
  protected async handleEvent(event: KeyCode): Promise<void> {
    switch (true) {
      case this.settings.suggestions &&
        this.isKey(this.settings.keys, "next", event):
        if (this.settings.list) {
          this.selectPreviousSuggestion();
        } else {
          this.selectNextSuggestion();
        }
        break;
      case this.settings.suggestions &&
        this.isKey(this.settings.keys, "previous", event):
        if (this.settings.list) {
          this.selectNextSuggestion();
        } else {
          this.selectPreviousSuggestion();
        }
        break;
      case this.isKey(this.settings.keys, "clear", event):
        this.inputValue = "";
        this.inputIndex = 0;
        break;
      default:
        await super.handleEvent(event);
    }
  }

  protected deleteChar(): void {
    if (this.digits.length == 0) {
      this.sign = "+";
    } else {
      this.digits = this.digits.slice(0, -1);
    }
    this.updateInputValue();
  }

  protected deleteCharRight(): void {
    if (this.digits.length == 0) {
      this.sign = "+";
    } else {
      this.digits = this.digits.slice(1);
    }
    this.updateInputValue();
  }

  /**
   * Add char to input.
   * @param char Char.
   */
  protected addChar(char: string): void {
    if (/[0-9]/.test(char)) {
      this.digits += char;
    } else if (char == "-" || char == "+") {
      this.sign = char;
    }
    this.updateInputValue();
  }

  protected updateInputValue(): void {
    this.inputValue = this.getValue();
    this.inputIndex = this.inputValue.length;
  }

  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  protected validate(value: string): boolean | string {
    return /^[\-+]?\d+\.\d*$/.test(value);
  }

  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  protected transform(value: string): BigNumber | undefined {
    return new BigNumber(value).decimalPlaces(2);
  }

  /**
   * Format output value.
   * @param value Output value.
   */
  protected format(value: BigNumber): string {
    return bigNumberToIfxAmount(value, 2);
  }

  /** Get input input. */
  protected getValue(): string {
    const dotIndex = -this.settings.decimalPlaces;
    const digits = this.digits.padStart(this.settings.decimalPlaces + 1, "0");
    return this.sign + digits.slice(0, dotIndex) + "." +
      digits.slice(dotIndex);
  }
}
