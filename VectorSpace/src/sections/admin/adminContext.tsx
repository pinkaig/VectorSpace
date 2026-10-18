/**
 * @file        adminContext.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       What every admin page shares: which school the top bar has picked and the
 *              admin API to call. (useLoad, the fetch-on-open helper, is in src/api/useLoad.ts.)
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ALL_SCHOOLS, createAdminApi, type AdminApi, type School, type SchoolFilter } from "../../api/admin";

type AdminContext = {
  api: AdminApi;
  schools: School[];
  // "all" or a school id: the School picker's value, which every admin page filters by
  schoolId: SchoolFilter;
  setSchoolId: (id: SchoolFilter) => void;
  // the picked school itself, or null while All schools is picked
  school: School | null;
  // re-read the school list (after a school is added, so the picker shows it)
  refreshSchools: () => Promise<void>;
};

const Context = createContext<AdminContext | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const api = useMemo(createAdminApi, []);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<SchoolFilter>(ALL_SCHOOLS);

  const refreshSchools = useCallback(async () => setSchools(await api.listSchools()), [api]);
  useEffect(() => {
    refreshSchools();
  }, [refreshSchools]);

  const value = useMemo<AdminContext>(
    () => ({ api, schools, schoolId, setSchoolId, school: schools.find((s) => s.id === schoolId) ?? null, refreshSchools }),
    [api, schools, schoolId, refreshSchools],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdmin(): AdminContext {
  const context = useContext(Context);
  if (!context) throw new Error("useAdmin must be used inside <AdminProvider>");
  return context;
}
