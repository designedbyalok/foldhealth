import { ProfileTable } from './ProfileTable';
import { profileRowClass, profileCellClass } from './profileTableClasses';

export default { title: 'Components/ProfileTable', component: ProfileTable };

const rows = [
  { id: 'bp', name: 'Blood Pressure', value: '120/80' },
  { id: 'hr', name: 'Heart Rate', value: '78' },
];

export const Default = {
  render: () => (
    <ProfileTable
      columns={[{ key: 'name', label: 'Name', width: 180 }, { key: 'value', label: 'Value' }]}
      rows={rows}
      renderRow={row => (
        <tr key={row.id} className={profileRowClass}>
          <td className={profileCellClass}>{row.name}</td>
          <td className={profileCellClass}>{row.value}</td>
        </tr>
      )}
    />
  ),
};
