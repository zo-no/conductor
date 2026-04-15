export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function printTable(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function print(data: unknown, json: boolean): void {
  if (json) {
    printJson(data)
  } else {
    printTable(data)
  }
}

export function error(msg: string): void {
  console.error(`Error: ${msg}`)
  process.exit(1)
}
