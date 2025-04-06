export class TransactionBuilder {
  private _date: Temporal.PlainDate;
  private _desc?: string = undefined
  
  constructor(date: string) {
    const [yyyy, mm, dd] = date.split('-');
    this._date = new Temporal.PlainDate(+yyyy, +mm, +dd)
  }

  desc(desc: string): TransactionBuilder {
    this._desc = desc;
    return this;
  }

}

export type Quantity = {
  exponent: bigint,
  value: bigint,
  unit: string,
}

function tx(strings: TemplateStringsArray, ...params: unknown[]): TransactionBuilder {
  const date = strings[0].split(' ')[0];
  return new TransactionBuilder(date);
}


const A = {
  Spend: "assets:spending",
  Reserve: "assets:reserve",
}




export type DateStr = `${YearStr}-${DayMonth}`
export type YearStr = "2024" | "2023"


export type DayStr28 = `0${Digit1to9}` | `1${Digit1to9}` | `2${Digit1to8}`;
export type DayStr30 = `0${Digit1to9}` | `1${Digit1to9}` | `2${Digit1to9}` | "30";
export type DayStr31 = DayStr30 | "31";

export type Month31 = "01" | "03" | "05" | "07" | "08" | "10" | "12";
export type Month30 = "04" | "06" | "09" | "11";
export type DayMonth = `${Month31}-${DayStr31}` | `${Month30}-${DayStr30}` | `02-${DayStr28}`
export type DayMonthLeap = `${Month31}-${DayStr31}` | `${Month30}-${DayStr30}` | `02-${DayStr28}` | "02-29"

export type Digit1to8 = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type Digit1to9 = Digit1to8 | "9";


