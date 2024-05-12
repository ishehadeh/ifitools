import { Input, InputOptions } from "cliffy/prompt/mod.ts";

export class DatePrompt extends Input {
  constructor(opts: Omit<InputOptions, "suggestions">) {
    super({ ...opts, suggestions: suggestDate });
  }

  protected transform(value: string): string | undefined {
    const [y, m, d] = value.split("-");
    const date = new Date(+y, +m - 1, +d);
    return date.toISOString();
  }

  protected validate(value: string): boolean {
    return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);
  }

  protected format(value: string): string {
    const date = new Date(value);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((x) => x.toFixed(0).padStart(2, "0"))
      .join("-");
  }
}

function suggestDate(inp: string): string[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  switch (true) {
    case /^[0-9]{4}((\-[0-9]{2})?)?$/.test(inp):
      return [inp + "-"];

    case /^[0-9]{4}-$/.test(inp): {
      const [_, y] = inp.match(/([0-9]{4})-/)!;
      const firstMonth = currentYear == +y ? currentMonth : 1;
      const monthSuggestions = [];
      for (let i = 0; i <= firstMonth; ++i) {
        monthSuggestions.push((firstMonth - i).toString().padStart(2, "0"));
      }
      for (let i = firstMonth; i < 12; ++i) {
        monthSuggestions.push(i.toString().padStart(2, "0"));
      }
      return monthSuggestions.map((m) => inp + m);
    }

    case /^[0-9]{4}-[0-9]{2}-$/.test(inp): {
      const [_, y, m] = inp.match(/([0-9]{4})-[0-9]{2}-/)!;
      const firstDay = currentYear == +y && currentMonth == +m ? currentDay : 1;
      const daySuggestions = [];
      for (let i = 0; i < firstDay; ++i) {
        daySuggestions.push((firstDay - i).toString().padStart(2, "0"));
      }
      for (let i = firstDay; i < 32; ++i) {
        daySuggestions.push(i.toString().padStart(2, "0"));
      }
      return daySuggestions.map((d) => inp + d);
    }

    default:
      return [0, 1, 2, 3]
        .map((x) => new Date().getFullYear() - x)
        .map((x) => x.toString().padStart(4, " "));
  }
}
