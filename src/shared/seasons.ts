export const seasons = ['default', 'summer', 'winter', 'fall', 'spring', 'halloween', 'black-friday', 'christmas', 'new-year', 'valentines', 'easter'] as const;
export type Season = typeof seasons[number];
export const seasonLabels: Record<Season, string> = { default: 'Original', summer: 'Summer', winter: 'Winter', fall: 'Fall', spring: 'Spring', halloween: 'Halloween', 'black-friday': 'Black Friday', christmas: 'Christmas', 'new-year': 'New Year', valentines: "Valentine’s Day", easter: 'Easter' };
