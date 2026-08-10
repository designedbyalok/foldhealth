import { useState } from 'react';
import {
  ComposedChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from '../../../../../../components/LazyRecharts/LazyRecharts';
import { Toggle } from '../../../../../../components/Toggle/Toggle';
import styles from './VitalsLabsTab.module.css';

function GraphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.33301 14.1673C1.05687 14.1673 0.833008 14.3912 0.833008 14.6673C0.833008 14.9435 1.05687 15.1673 1.33301 15.1673V14.6673V14.1673ZM14.6663 14.6673V14.1673H1.33301V14.6673V15.1673H14.6663V14.6673ZM10.9997 8.66732V9.16732H12.9997V8.66732V8.16732H10.9997V8.66732ZM13.9997 9.66732H13.4997V14.6673H13.9997H14.4997V9.66732H13.9997ZM9.99967 14.6673H10.4997V9.66732H9.99967H9.49967V14.6673H9.99967ZM12.9997 8.66732V9.16732C13.2758 9.16732 13.4997 9.39118 13.4997 9.66732H13.9997H14.4997C14.4997 8.83889 13.8281 8.16732 12.9997 8.16732V8.66732ZM10.9997 8.66732V8.16732C10.1712 8.16732 9.49967 8.83889 9.49967 9.66732H9.99967H10.4997C10.4997 9.39118 10.7235 9.16732 10.9997 9.16732V8.66732ZM9.99967 3.33398H9.49967V14.6673H9.99967H10.4997V3.33398H9.99967ZM5.99967 14.6673H6.49967V3.33398H5.99967H5.49967V14.6673H5.99967ZM7.99967 1.33398V1.83398C8.48521 1.83398 8.79907 1.83505 9.03032 1.86614C9.24719 1.89529 9.31517 1.94237 9.35323 1.98043L9.70678 1.62688L10.0603 1.27332C9.8055 1.01849 9.49133 0.919121 9.16357 0.875055C8.8502 0.832923 8.45694 0.833984 7.99967 0.833984V1.33398ZM9.99967 3.33398H10.4997C10.4997 2.87671 10.5007 2.48346 10.4586 2.17009C10.4145 1.84233 10.3152 1.52816 10.0603 1.27332L9.70678 1.62688L9.35323 1.98043C9.39129 2.01849 9.43836 2.08647 9.46752 2.30334C9.49861 2.53459 9.49967 2.84845 9.49967 3.33398H9.99967ZM7.99967 1.33398V0.833984C7.54241 0.833984 7.14915 0.832923 6.83578 0.875055C6.50802 0.919121 6.19385 1.01849 5.93901 1.27332L6.29257 1.62688L6.64612 1.98043C6.68418 1.94237 6.75216 1.89529 6.96903 1.86614C7.20028 1.83505 7.51414 1.83398 7.99967 1.83398V1.33398ZM5.99967 3.33398H6.49967C6.49967 2.84844 6.50074 2.53459 6.53183 2.30334C6.56099 2.08647 6.60806 2.01849 6.64612 1.98043L6.29257 1.62688L5.93901 1.27332C5.68418 1.52816 5.58481 1.84233 5.54074 2.17009C5.49861 2.48346 5.49967 2.87671 5.49967 3.33398H5.99967ZM2.99967 5.33398V5.83398H4.99967V5.33398V4.83398H2.99967V5.33398ZM5.99967 6.33398H5.49967V14.6673H5.99967H6.49967V6.33398H5.99967ZM1.99967 14.6673H2.49967V6.33398H1.99967H1.49967V14.6673H1.99967ZM4.99967 5.33398V5.83398C5.27582 5.83398 5.49967 6.05784 5.49967 6.33398H5.99967H6.49967C6.49967 5.50556 5.8281 4.83398 4.99967 4.83398V5.33398ZM2.99967 5.33398V4.83398C2.17125 4.83398 1.49967 5.50556 1.49967 6.33398H1.99967H2.49967C2.49967 6.05784 2.72353 5.83398 2.99967 5.83398V5.33398Z" fill="currentColor"/>
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8.50003C12.2761 8.50003 12.5 8.27618 12.5 8.00003C12.5 7.72389 12.2761 7.50003 12 7.50003V8.00003V8.50003ZM4 7.50003C3.72386 7.50003 3.5 7.72389 3.5 8.00003C3.5 8.27618 3.72386 8.50003 4 8.50003V8.00003V7.50003ZM8.5 4C8.5 3.72386 8.27614 3.5 8 3.5C7.72386 3.5 7.5 3.72386 7.5 4L8 4L8.5 4ZM7.5 12C7.5 12.2761 7.72386 12.5 8 12.5C8.27614 12.5 8.5 12.2761 8.5 12H8H7.5ZM12 8.00003V7.50003H8V8.00003V8.50003H12V8.00003ZM8 8.00003V7.50003H4V8.00003V8.50003H8V8.00003ZM8 4L7.5 4L7.5 8.00003L8 8.00003H8.5L8.5 4L8 4ZM8 8.00003H7.5V12H8H8.5V8.00003H8Z" fill="currentColor"/>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.68656 2.98043C3.4913 2.78517 3.17472 2.78517 2.97945 2.98043C2.78419 3.17569 2.78419 3.49228 2.97945 3.68754L3.33301 3.33398L3.68656 2.98043ZM11.6461 12.3542C11.8414 12.5495 12.158 12.5495 12.3532 12.3542C12.5485 12.1589 12.5485 11.8424 12.3532 11.6471L11.9997 12.0007L11.6461 12.3542ZM10.6592 3.30078L11.013 2.94741V2.94741L10.6592 3.30078ZM12.7141 5.35773L13.0678 5.00436V5.00436L12.7141 5.35773ZM5.82526 12.9533L5.47152 13.3067H5.47152L5.82526 12.9533ZM3.0808 10.2061L3.43453 9.85269H3.43453L3.0808 10.2061ZM3.89637 7.11629L4.02926 7.59831H4.02926L3.89637 7.11629ZM4.86745 6.7574L4.57531 6.35163L4.57531 6.35163L4.86745 6.7574ZM5.49744 6.85188C5.67655 6.64171 5.65137 6.32613 5.4412 6.14702C5.23103 5.9679 4.91545 5.99308 4.73633 6.20326L5.11689 6.52757L5.49744 6.85188ZM8.92006 12.1348L9.40214 12.2674V12.2674L8.92006 12.1348ZM9.27761 11.165L9.68385 11.4565V11.4565L9.27761 11.165ZM9.82766 11.299C10.0364 11.1182 10.0591 10.8024 9.87832 10.5937C9.69755 10.3849 9.38178 10.3622 9.17303 10.543L9.50034 10.921L9.82766 11.299ZM1.81198 8.50413L1.31199 8.50729L1.31199 8.50729L1.81198 8.50413ZM1.95331 7.96871L2.38659 8.21824V8.21824L1.95331 7.96871ZM7.5365 14.2294L7.53725 13.7294H7.53725L7.5365 14.2294ZM8.06186 14.0904L7.81403 13.6562L7.81403 13.6562L8.06186 14.0904ZM14.6431 8.20393L15.1318 8.30961L15.1318 8.30961L14.6431 8.20393ZM11.5351 9.5288C11.2766 9.62592 11.1458 9.91421 11.2429 10.1727C11.34 10.4312 11.6283 10.562 11.8868 10.4649L11.711 9.99685L11.5351 9.5288ZM7.79784 1.35802L7.90557 1.84628V1.84628L7.79784 1.35802ZM5.54796 4.15288C5.45296 4.41217 5.58614 4.69937 5.84543 4.79437C6.10472 4.88937 6.39192 4.75619 6.48692 4.49691L6.01744 4.32489L5.54796 4.15288ZM0.979274 14.3139C0.784112 14.5093 0.784273 14.8259 0.979634 15.0211C1.175 15.2162 1.49158 15.2161 1.68674 15.0207L1.33301 14.6673L0.979274 14.3139ZM4.78889 11.9154C4.98405 11.72 4.98389 11.4034 4.78853 11.2083C4.59317 11.0131 4.27659 11.0133 4.08142 11.2086L4.43516 11.562L4.78889 11.9154ZM3.33301 3.33398L2.97945 3.68754L11.6461 12.3542L11.9997 12.0007L12.3532 11.6471L3.68656 2.98043L3.33301 3.33398ZM10.6592 3.30078L10.3055 3.65416L12.3604 5.7111L12.7141 5.35773L13.0678 5.00436L11.013 2.94741L10.6592 3.30078ZM5.82526 12.9533L6.17899 12.5999L3.43453 9.85269L3.0808 10.2061L2.72707 10.5594L5.47152 13.3067L5.82526 12.9533ZM3.89637 7.11629L4.02926 7.59831C4.50355 7.46755 4.86447 7.37565 5.15959 7.16318L4.86745 6.7574L4.57531 6.35163C4.46003 6.43463 4.31034 6.48351 3.76348 6.63428L3.89637 7.11629ZM4.86745 6.7574L5.15959 7.16318C5.28432 7.07339 5.39775 6.96886 5.49744 6.85188L5.11689 6.52757L4.73633 6.20326C4.68881 6.25903 4.63474 6.30884 4.57531 6.35163L4.86745 6.7574ZM8.92006 12.1348L9.40214 12.2674C9.55233 11.7215 9.60106 11.5719 9.68385 11.4565L9.27761 11.165L8.87136 10.8736C8.65979 11.1684 8.56827 11.5286 8.43797 12.0021L8.92006 12.1348ZM9.50034 10.921L9.17303 10.543C9.05988 10.641 8.95863 10.7519 8.87136 10.8736L9.27761 11.165L9.68385 11.4565C9.72547 11.3985 9.77373 11.3456 9.82766 11.299L9.50034 10.921ZM3.0808 10.2061L3.43453 9.85269C3.00377 9.42149 2.71167 9.128 2.52211 8.88985C2.33191 8.65087 2.31227 8.54742 2.31197 8.50097L1.81198 8.50413L1.31199 8.50729C1.31444 8.89542 1.50719 9.22048 1.73969 9.5126C1.97285 9.80554 2.31378 10.1457 2.72707 10.5594L3.0808 10.2061ZM3.89637 7.11629L3.76348 6.63428C3.19999 6.78963 2.73565 6.91685 2.38832 7.05629C2.04195 7.19534 1.71378 7.38275 1.52003 7.71917L1.95331 7.96871L2.38659 8.21824C2.40967 8.17816 2.47763 8.09801 2.76087 7.9843C3.04316 7.87097 3.44192 7.76024 4.02926 7.59831L3.89637 7.11629ZM1.81198 8.50413L2.31197 8.50097C2.31134 8.40174 2.33711 8.30415 2.38659 8.21824L1.95331 7.96871L1.52003 7.71917C1.38203 7.95878 1.31025 8.23079 1.31199 8.50729L1.81198 8.50413ZM5.82526 12.9533L5.47152 13.3067C5.88743 13.723 6.22944 14.0665 6.52398 14.3011C6.81769 14.535 7.14493 14.7288 7.53575 14.7294L7.5365 14.2294L7.53725 13.7294C7.49095 13.7293 7.38728 13.7102 7.14699 13.5189C6.90755 13.3281 6.61249 13.0339 6.17899 12.5999L5.82526 12.9533ZM8.92006 12.1348L8.43797 12.0021C8.27519 12.5938 8.16383 12.9956 8.04973 13.2798C7.93522 13.5651 7.85442 13.6331 7.81403 13.6562L8.06186 14.0904L8.30968 14.5247C8.64904 14.331 8.83785 14.0009 8.97776 13.6523C9.11808 13.3027 9.24596 12.8351 9.40214 12.2674L8.92006 12.1348ZM7.5365 14.2294L7.53575 14.7294C7.80716 14.7298 8.07395 14.6592 8.30968 14.5247L8.06186 14.0904L7.81403 13.6562C7.72969 13.7043 7.63428 13.7295 7.53725 13.7294L7.5365 14.2294ZM12.7141 5.35773L12.3604 5.7111C13.0693 6.42079 13.5598 6.91367 13.8608 7.31984C14.1565 7.71889 14.1905 7.93125 14.1544 8.09826L14.6431 8.20393L15.1318 8.30961C15.2584 7.72426 15.0251 7.21145 14.6643 6.72447C14.3087 6.2446 13.7533 5.69056 13.0678 5.00436L12.7141 5.35773ZM11.711 9.99685L11.8868 10.4649C12.7944 10.1239 13.529 9.84932 14.051 9.55957C14.5809 9.2655 15.0052 8.89504 15.1318 8.30961L14.6431 8.20393L14.1544 8.09826C14.1183 8.26519 13.9997 8.44434 13.5658 8.68521C13.124 8.93041 12.4738 9.1761 11.5351 9.5288L11.711 9.99685ZM10.6592 3.30078L11.013 2.94741C10.3224 2.25612 9.76504 1.69633 9.28272 1.33824C8.79357 0.975083 8.27799 0.740068 7.69012 0.869767L7.79784 1.35802L7.90557 1.84628C8.07205 1.80955 8.28483 1.84285 8.68661 2.14115C9.09522 2.44451 9.5914 2.93932 10.3055 3.65416L10.6592 3.30078ZM6.01744 4.32489L6.48692 4.49691C6.83466 3.54782 7.07708 2.89 7.32046 2.44275C7.55981 2.00291 7.73899 1.88303 7.90557 1.84628L7.79784 1.35802L7.69012 0.869767C7.10234 0.999447 6.73335 1.42953 6.44209 1.96477C6.15486 2.49261 5.88426 3.23501 5.54796 4.15288L6.01744 4.32489ZM1.33301 14.6673L1.68674 15.0207L4.78889 11.9154L4.43516 11.562L4.08142 11.2086L0.979274 14.3139L1.33301 14.6673Z" fill="currentColor"/>
    </svg>
  );
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Table data ──────────────────────────────────────────────────────────────

const TABLE_SECTIONS = [
  {
    id: 'vitals', title: 'Vitals',
    rows: [
      { id: 'bp',   name: 'Blood Pressure',    unit: 'mmHg',        hasPin: true,
        values: [{ v: '145/90', date: '3/9/25' }, { v: '130/80', date: '3/1/25' }, { v: '120/80', date: '2/24/25' }] },
      { id: 'spo2', name: 'Blood Oxygen',       unit: '%',           hasPin: true,
        values: [{ v: '98%', date: '3/9/25' }, { v: '95%', date: '3/1/25', flag: true }, { v: '97%', date: '2/24/25', flag: true }] },
      { id: 'rr',   name: 'Respiration Rate',   unit: 'breaths/min', hasPin: false,
        values: [{ v: '22', date: '3/9/25' }, { v: '18', date: '3/1/25' }, { v: '20', date: '2/24/25' }] },
      { id: 'ht',   name: 'Height',             unit: 'ft',          hasPin: false,
        values: [{ v: '5\'8"', date: '3/9/25' }, { v: '5\'8"', date: '3/1/25' }, { v: '5\'8"', date: '2/24/25' }] },
      { id: 'wt',   name: 'Weight',             unit: 'lbs',         hasPin: false,
        values: [{ v: '150', date: '3/9/25' }, { v: '175', date: '3/1/25', flag: true }, { v: '200', date: '2/24/25', flag: true }] },
      { id: 'bmi',  name: 'BMI',                unit: 'BMI',         hasPin: false,
        values: [{ v: '22.5', date: '3/9/25' }, { v: '27.3', date: '3/1/25', flag: true }, { v: '24.1', date: '2/24/25', flag: true }] },
      { id: 'bt',   name: 'Body Temperature',   unit: '°F',          hasPin: false,
        values: [{ v: '98.6', date: '3/9/25' }, { v: '99.1', date: '3/1/25' }, { v: '97.8', date: '2/24/25' }] },
      { id: 'hc',   name: 'Head Circumference', unit: 'cm',          hasPin: false,
        values: [{ v: '48', date: '3/9/25', flag: true }, { v: '45', date: '3/1/25' }, { v: '44', date: '2/24/25' }] },
    ],
  },
  {
    id: 'biomarkers', title: 'Biomarkers',
    rows: [
      { id: 'bg',  name: 'Blood Glucose',      unit: 'mg/dL', hasPin: true,
        values: [{ v: '85', date: '3/9/25' }, { v: '92', date: '3/1/25' }, { v: '78', date: '2/24/25' }] },
      { id: 'rhr', name: 'Resting Heart Rate', unit: 'bpm',   hasPin: false,
        values: [{ v: '72', date: '3/9/25' }, { v: '68', date: '3/1/25' }, { v: '75', date: '2/24/25', flag: true }] },
    ],
  },
  {
    id: 'activity', title: 'Activity',
    rows: [
      { id: 'steps', name: 'Steps', unit: 'steps', hasPin: false,
        values: [{ v: '5,675', date: '3/9/25' }, { v: '4,321', date: '3/1/25', flag: true }, { v: '7,890', date: '2/24/25' }] },
    ],
  },
  {
    id: 'lab', title: 'Lab Monitoring',
    rows: [
      { id: 'hba1c', name: 'HbA1c',             unit: '%',     hasPin: false,
        values: [{ v: '6.8', date: '3/9/25' }, { v: '7.2', date: '3/1/25', flag: true }, { v: '6.5', date: '2/24/25' }] },
      { id: 'chol',  name: 'Total Cholesterol',  unit: 'mg/dL', hasPin: false,
        values: [{ v: '185', date: '3/9/25' }, { v: '210', date: '3/1/25', flag: true }, { v: '195', date: '2/24/25' }] },
      { id: 'ldl',   name: 'LDL',               unit: 'mg/dL', hasPin: false,
        values: [{ v: '112', date: '3/9/25' }, { v: '130', date: '3/1/25', flag: true }, { v: '118', date: '2/24/25' }] },
    ],
  },
];

// ── Graph data ──────────────────────────────────────────────────────────────

const GRAPH_SECTIONS = [
  {
    id: 'vitals', title: 'Vitals', showRangeToggle: true,
    metrics: [
      {
        id: 'bp', title: 'Blood Pressure', unit: 'mmHg',
        lastRecorded: '03/05/2024 • Apple Watch', type: 'range', shapeStyle: 'bp',
        yDomain: [0, 160], yTicks: [0, 40, 80, 120, 160], xLabel: 'Days',
        legend: ['Sys', 'Dia'],
        stats: [
          { val: '120/80', unit: 'mmHg', label: 'Weekly Avg' },
          { val: '105–140', unit: 'mmHg', label: 'Range' },
          { val: '65–95', unit: 'mmHg', label: 'Diastolic' },
        ],
        data: {
          '1D': [
            { t: '9am',  dia: 78, range: 44 }, { t: '11am', dia: 80, range: 42 },
            { t: '1pm',  dia: 82, range: 38 }, { t: '3pm',  dia: 79, range: 43 },
            { t: '5pm',  dia: 81, range: 39 }, { t: '7pm',  dia: 77, range: 45 },
          ],
          '1W': [
            { t: '12 Mar', dia: 80, range: 40 }, { t: '13 Mar', dia: 85, range: 45 },
            { t: '14 Mar', dia: 75, range: 40 }, { t: '15 Mar', dia: 80, range: 45 },
            { t: '16 Mar', dia: 78, range: 40 }, { t: '17 Mar', dia: 76, range: 46 },
          ],
          '3W': [
            { t: 'Feb 26', dia: 78, range: 42 }, { t: 'Mar 5',  dia: 80, range: 40 },
            { t: 'Mar 12', dia: 82, range: 38 }, { t: 'Mar 17', dia: 76, range: 46 },
          ],
        },
      },
      {
        id: 'spo2', title: 'Blood Oxygen', unit: '%',
        lastRecorded: '03/05/2024 • Apple Watch', type: 'line',
        yDomain: [85, 100], yTicks: [85, 90, 95, 100], xLabel: 'Days',
        stats: [
          { val: '94', unit: '%', label: 'Weekly Avg' },
          { val: '93–99', unit: '%', label: 'Range' },
        ],
        data: {
          '1D': [
            { t: '9am',  v: 97 }, { t: '11am', v: 96 },
            { t: '1pm',  v: 98 }, { t: '3pm',  v: 95 },
            { t: '5pm',  v: 97 }, { t: '7pm',  v: 96 },
          ],
          '1W': [
            { t: '12 Mar', v: 97 }, { t: '13 Mar', v: 95 },
            { t: '14 Mar', v: 98 }, { t: '15 Mar', v: 96 },
            { t: '16 Mar', v: 97 }, { t: '17 Mar', v: 95 },
          ],
          '3W': [
            { t: 'Feb 26', v: 96 }, { t: 'Mar 5',  v: 97 },
            { t: 'Mar 12', v: 95 }, { t: 'Mar 17', v: 98 },
          ],
        },
      },
    ],
  },
  {
    id: 'biomarkers', title: 'Biomarkers', showRangeToggle: false,
    metrics: [
      {
        id: 'bg', title: 'Blood Glucose (Daily Average)', unit: 'mg/dL',
        lastRecorded: '03/05/2024 9:30 AM • Libre',
        subtitle: 'Data available for 5/7 Days',
        type: 'line',
        yDomain: [0, 300], yTicks: [0, 100, 200, 300], xLabel: 'Hours',
        stats: [
          { val: '112', unit: 'mg/dL', label: 'Weekly Avg' },
          { val: '66–217', unit: 'mg/dL', label: 'Range' },
        ],
        data: {
          '1D': [
            { t: '12am', v: 130 }, { t: '3am', v: 108 }, { t: '6am',  v: 115 },
            { t: '9am',  v: 185 }, { t: '12pm', v: 245 }, { t: '3pm', v: 175 },
            { t: '6pm',  v: 130 }, { t: '9pm',  v: 150 },
          ],
          '1W': [
            { t: 'Mon', v: 112 }, { t: 'Tue', v: 135 }, { t: 'Wed', v: 108 },
            { t: 'Thu', v: 155 }, { t: 'Fri', v: 125 }, { t: 'Sat', v: 148 }, { t: 'Sun', v: 118 },
          ],
          '3W': [
            { t: 'W1', v: 120 }, { t: 'W2', v: 138 }, { t: 'W3', v: 112 },
          ],
        },
      },
    ],
  },
  {
    id: 'activity', title: 'Activity', showRangeToggle: false,
    metrics: [
      {
        id: 'steps', title: 'Steps', unit: 'steps',
        lastRecorded: '03/05/2024 • Fitbit',
        type: 'line',
        yDomain: [0, 12000], yTicks: [0, 4000, 8000, 12000], xLabel: 'Days',
        stats: [
          { val: '5,962', unit: 'steps', label: 'Weekly Avg' },
          { val: '4,321–7,890', unit: 'steps', label: 'Range' },
        ],
        data: {
          '1D': [
            { t: '6am', v: 450 }, { t: '9am', v: 2100 }, { t: '12pm', v: 4200 },
            { t: '3pm', v: 5800 }, { t: '6pm', v: 7200 }, { t: '9pm', v: 7890 },
          ],
          '1W': [
            { t: 'Mon', v: 5675 }, { t: 'Tue', v: 4321 }, { t: 'Wed', v: 7890 },
            { t: 'Thu', v: 6200 }, { t: 'Fri', v: 5400 }, { t: 'Sat', v: 8100 }, { t: 'Sun', v: 4800 },
          ],
          '3W': [
            { t: 'W1', v: 5200 }, { t: 'W2', v: 6100 }, { t: 'W3', v: 5962 },
          ],
        },
      },
    ],
  },
];

// ── Custom range bar shapes ───────────────────────────────────────────────────

function makeRangeShape(topColor, botColor, shapeStyle) {
  return function RangeShape({ x, y, width, height }) {
    if (!height || height <= 0 || width == null) return null;
    const cx = x + width / 2;

    if (shapeStyle === 'bar') {
      // Thin filled capsule bar (Blood Oxygen style)
      const bw = 4;
      return <rect x={cx - bw / 2} y={y} width={bw} height={Math.max(height, 1)} fill={topColor} rx={2} />;
    }

    // 'bp' style: line + circle top + diamond bottom
    const ds = 3.5;
    return (
      <g>
        <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={topColor} strokeWidth={1.5} />
        <circle cx={cx} cy={y} r={3.5} fill={topColor} />
        <path
          d={`M${cx},${y + height - ds} L${cx + ds},${y + height} L${cx},${y + height + ds} L${cx - ds},${y + height} Z`}
          fill={botColor}
        />
      </g>
    );
  };
}

// ── Metric Chart ─────────────────────────────────────────────────────────────

function MetricChart({ metric, range, colors }) {
  const { topColor, botColor, lineColor, gridColor, axisColor } = colors;
  const data = metric.data[range] || metric.data['1W'];
  const RangeShape = makeRangeShape(topColor, botColor, metric.shapeStyle || 'bp');

  const axisProps = {
    tick: { fontSize: 11, fill: axisColor, fontFamily: 'Inter, sans-serif' },
    axisLine: false,
    tickLine: false,
  };

  const innerChart = metric.type === 'range' ? (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="none" />
        <XAxis dataKey="t" {...axisProps} />
        <YAxis domain={metric.yDomain} ticks={metric.yTicks} width={40} {...axisProps} tick={{ ...axisProps.tick, dy: 0 }} />
        <Bar dataKey="dia" stackId="r" fill="transparent" stroke="none" isAnimationActive={false} barSize={24} />
        <Bar dataKey="range" stackId="r" shape={<RangeShape />} fill="transparent" stroke="none" isAnimationActive={false} barSize={24} />
      </ComposedChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="none" />
        <XAxis dataKey="t" {...axisProps} />
        <YAxis domain={metric.yDomain} ticks={metric.yTicks} width={40} {...axisProps} />
        <Bar dataKey="__dummy" fill="transparent" stroke="none" isAnimationActive={false} barSize={1} />
        <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5}
          dot={{ r: 2.5, fill: lineColor, strokeWidth: 0 }} activeDot={{ r: 4, fill: lineColor }} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className={styles.chartArea}>
      <span className={styles.yLabel}>{metric.unit}</span>
      <div className={styles.chartAreaInner}>{innerChart}</div>
    </div>
  );
}

// ── Table View ───────────────────────────────────────────────────────────────

function TableView({ onOpenGraph }) {
  return (
    <div className={styles.tableView}>
      {TABLE_SECTIONS.map(section => (
        <div key={section.id} className={styles.tableSection}>
          <div className={styles.tableSectionHeader}>
            <span className={styles.tableSectionTitle}>{section.title}</span>
            <div className={styles.tableSectionActions}>
              <button className={styles.graphIconBtn} onClick={() => onOpenGraph(section.id)} title="View graphs">
                <GraphIcon />
              </button>
              <span className={styles.sectionActionDivider} />
              <button className={styles.addIconBtn} title="Add">
                <AddIcon />
              </button>
            </div>
          </div>

          <div className={styles.colHeader}>
            <span className={styles.colNameLabel}>Name</span>
            <span className={styles.colValuesLabel}>Values</span>
          </div>

          {section.rows.map(row => (
            <div key={row.id} className={styles.row}>
              <div className={styles.nameCell}>
                <div className={styles.nameRow}>
                  <span className={styles.rowName}>{row.name}</span>
                  {row.hasPin && <TrendIcon />}
                </div>
                <span className={styles.rowUnit}>{row.unit}</span>
              </div>
              <div className={styles.valuesCell}>
                {row.values.map((val, i) => (
                  <div key={i} className={styles.valueItem}>
                    <span className={`${styles.val} ${val.flag ? styles.valFlag : ''}`}>{val.v}</span>
                    <span className={styles.valDate}>{val.date}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Graph View ───────────────────────────────────────────────────────────────

function GraphView({ onClose }) {
  const [range, setRange] = useState('1W');

  const topColor  = cssVar('--chart-1');
  const botColor  = cssVar('--chart-2');
  const lineColor = cssVar('--chart-1');
  const gridColor = cssVar('--neutral-100');
  const axisColor = cssVar('--neutral-300');
  const colors = { topColor, botColor, lineColor, gridColor, axisColor };

  return (
    <div className={styles.graphView}>
      {GRAPH_SECTIONS.map(section => (
        <div key={section.id}>
          <div className={styles.graphSectionHeader}>
            <span className={styles.graphSectionTitle}>{section.title}</span>
            {section.showRangeToggle && (
              <Toggle items={['1D', '1W', '3W']} active={range} onChange={setRange} size="S" />
            )}
            {section.id === GRAPH_SECTIONS[0].id && (
              <button className={styles.listIconBtn} onClick={onClose} title="Back to list">
                <ListIcon />
              </button>
            )}
            <button className={styles.addIconBtn} title="Add">
              <AddIcon />
            </button>
          </div>

          {section.metrics.map(metric => (
            <div key={metric.id} className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <div className={styles.metricTitleGroup}>
                  <span className={styles.metricTitle}>{metric.title}</span>
                  <span className={styles.metricSub}>Last Recorded on {metric.lastRecorded}</span>
                  {metric.subtitle && <span className={styles.metricSub}>{metric.subtitle}</span>}
                </div>
                {metric.legend && (
                  <div className={styles.legend}>
                    <span className={styles.legendCircle} style={{ background: topColor }} />
                    <span className={styles.legendLabel}>{metric.legend[0]}</span>
                    <span className={styles.legendDiamond} style={{ background: botColor }} />
                    <span className={styles.legendLabel}>{metric.legend[1]}</span>
                  </div>
                )}
              </div>

              <div className={styles.chartWrap}>
                <MetricChart metric={metric} range={range} colors={colors} />
                <div className={styles.xAxisLabel}>{metric.xLabel}</div>
              </div>

              <div className={styles.statsBar}>
                {metric.stats.flatMap((stat, i) => [
                  i > 0 ? <span key={`d${i}`} className={styles.statDivider} /> : null,
                  <div key={`s${i}`} className={styles.statItem}>
                    <span className={styles.statLine}>
                      <span className={styles.statValue}>{stat.val}</span>
                      {stat.unit && <span className={styles.statUnit}> {stat.unit}</span>}
                    </span>
                    <span className={styles.statLabel}>{stat.label}</span>
                  </div>,
                ])}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function VitalsLabsTab() {
  const [graphOpen, setGraphOpen] = useState(false);
  return (
    <div className={styles.wrapper}>
      {graphOpen
        ? <GraphView onClose={() => setGraphOpen(false)} />
        : <TableView onOpenGraph={() => setGraphOpen(true)} />
      }
    </div>
  );
}
