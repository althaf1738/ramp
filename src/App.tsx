import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { InputSelect } from "./components/InputSelect"
import { Instructions } from "./components/Instructions"
import { Transactions } from "./components/Transactions"
import { useEmployees } from "./hooks/useEmployees"
import { usePaginatedTransactions } from "./hooks/usePaginatedTransactions"
import { useTransactionsByEmployee } from "./hooks/useTransactionsByEmployee"
import { EMPTY_EMPLOYEE } from "./utils/constants"
import { Employee } from "./utils/types"
import { useCustomFetch } from "./hooks/useCustomFetch"

export function App() {
  const { data: employees, ...employeeUtils } = useEmployees()
  const { data: paginatedTransactions, ...paginatedTransactionsUtils } = usePaginatedTransactions()
  const { data: transactionsByEmployee, ...transactionsByEmployeeUtils } = useTransactionsByEmployee()
  const [approvalMap, setApprovalMap] = useState<Map<string, boolean>>(new Map())

  const { fetchWithoutCache } = useCustomFetch()

  const transactions = useMemo(
    () => paginatedTransactions?.data ?? transactionsByEmployee ?? null,
    [paginatedTransactions, transactionsByEmployee]
  )

  const visibleTransactions = useMemo(() => {
    if (!transactions) return null

    return transactions.map((tx) => ({
      ...tx,
      approved: approvalMap.has(tx.id) ? approvalMap.get(tx.id)! : tx.approved,
    }))
  }, [transactions, approvalMap])

  const setTransactionApproval = useCallback(
    async ({ transactionId, newValue }: { transactionId: string; newValue: boolean }) => {
      await fetchWithoutCache("setTransactionApproval", {
        transactionId,
        value: newValue,
      })

      setApprovalMap((prev) => {
        const newMap = new Map(prev)
        newMap.set(transactionId, newValue)
        return newMap
      })
    },
    [paginatedTransactionsUtils]
  )

  const loadAllTransactions = useCallback(async () => {
    transactionsByEmployeeUtils.invalidateData()

    await employeeUtils.fetchAll()
    await paginatedTransactionsUtils.fetchAll()
  }, [employeeUtils, paginatedTransactionsUtils, transactionsByEmployeeUtils])

  const loadTransactionsByEmployee = useCallback(
    async (employeeId: string) => {
      paginatedTransactionsUtils.invalidateData()
      await transactionsByEmployeeUtils.fetchById(employeeId)
    },
    [paginatedTransactionsUtils, transactionsByEmployeeUtils]
  )

  useEffect(() => {
    if (employees === null && !employeeUtils.loading) {
      loadAllTransactions()
    }
  }, [employeeUtils.loading, employees, loadAllTransactions])

  return (
    <Fragment>
      <main className="MainContainer">
        <Instructions />

        <hr className="RampBreak--l" />

        <InputSelect<Employee>
          isLoading={employeeUtils.loading}
          defaultValue={EMPTY_EMPLOYEE}
          items={employees === null ? [] : [EMPTY_EMPLOYEE, ...employees]}
          label="Filter by employee"
          loadingLabel="Loading employees"
          parseItem={(item) => ({
            value: item.id,
            label: `${item.firstName} ${item.lastName}`,
          })}
          onChange={async (newValue) => {
            if (newValue === null || newValue.id === EMPTY_EMPLOYEE.id) {
              await loadAllTransactions()
            } else {
              await loadTransactionsByEmployee(newValue.id)
            }
          }}
        />

        <div className="RampBreak--l" />

        <div className="RampGrid">
          <Transactions
            transactions={visibleTransactions}
            setTransactionApproval={setTransactionApproval}
          />

          {paginatedTransactions !== null &&
            paginatedTransactionsUtils.hasMore &&
            transactionsByEmployee === null && (
              <button
                className="RampButton"
                disabled={paginatedTransactionsUtils.loading}
                onClick={async () => {
                  await loadAllTransactions()
                }}
              >
                View More
              </button>
            )}
        </div>
      </main>
    </Fragment>
  )
}
