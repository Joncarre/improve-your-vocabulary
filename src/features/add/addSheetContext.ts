import { createContext, useContext } from 'react'

export interface AddSheetInitial {
  word?: string
  sentence?: string
}

interface AddSheetApi {
  /** Opens the "add word" sheet (a dialog on desktop). */
  openAdd: (initial?: AddSheetInitial) => void
}

export const AddSheetContext = createContext<AddSheetApi>({ openAdd: () => undefined })

export function useAddSheet(): AddSheetApi {
  return useContext(AddSheetContext)
}
