import { useMemo, useState } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { SearchBar } from '../../../../components/SearchBar/SearchBar';
import { Pagination } from '../../../../components/Pagination/Pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/Dialog/Dialog';
import styles from './AccessControl.module.css';

/** Everyone who has the role. Read-only: roles are given in Users. */
export function RoleUsersDialog({ role, users, onClose }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter(u => u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) : sorted;
  }, [users, query]);
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className={styles.usersDialog}>
        <DialogHeader>
          <DialogTitle>{role?.name}</DialogTitle>
          <DialogDescription>{users.length} {users.length === 1 ? 'User' : 'Users'}</DialogDescription>
        </DialogHeader>
        <SearchBar
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search users"
          autoFocus={false}
          fullWidth
        />
        <div className={styles.usersTable}>
          <div className={styles.usersHeadRow}>Member Name</div>
          <div className={styles.usersBody}>
            {pageRows.map(u => (
              <div key={u.id} className={styles.userRow}>
                <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
                <div className={styles.userText}>
                  <span className={styles.userName}>{u.name}</span>
                  {u.email && <span className={styles.userEmail}>{u.email}</span>}
                </div>
              </div>
            ))}
            {pageRows.length === 0 && <p className={styles.noMatch}>No users match “{query}”.</p>}
          </div>
          {filtered.length > perPage && (
            <div className={styles.usersPager}>
              <Pagination
                totalItems={filtered.length}
                currentPage={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
