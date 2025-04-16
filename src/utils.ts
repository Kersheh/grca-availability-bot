import { format, parseISO } from 'date-fns';

export const formatDate = (date: string) => format(parseISO(date), 'MMM dd, yyyy');
