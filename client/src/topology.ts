import type { NodeId } from './types/game';

export interface NodeDef {
    id: NodeId;
    label: string;
    hub?: 'A' | 'B' | 'C'; // Optional now or derived
    role: 'Hub' | 'Bridge' | 'Outlier';
    neighbors: NodeId[];
}

export const NODES: Record<NodeId, NodeDef> = {
    // HUBS (Los Santos districts: only the labels changed for Round 2)
    '1': { id: '1', label: 'Vinewood', role: 'Hub', neighbors: ['3', '4', '5'] },
    '2': { id: '2', label: 'Downtown', role: 'Hub', neighbors: ['4', '5', '6'] },

    // BRIDGES (Connecting Hubs and Outliers)
    '3': { id: '3', label: 'Rockford Hills', role: 'Bridge', neighbors: ['1', '7', '8'] },
    '4': { id: '4', label: 'Mirror Park', role: 'Bridge', neighbors: ['1', '2', '9'] },
    '5': { id: '5', label: 'Vespucci', role: 'Bridge', neighbors: ['1', '2', '10'] },
    '6': { id: '6', label: 'La Mesa', role: 'Bridge', neighbors: ['2', '11', '12'] },

    // OUTLIERS (Only 1 connection)
    '7': { id: '7', label: 'Davis', role: 'Outlier', neighbors: ['3'] },
    '8': { id: '8', label: 'Strawberry', role: 'Outlier', neighbors: ['3'] },
    '9': { id: '9', label: 'Sandy Shores', role: 'Outlier', neighbors: ['4'] },
    '10': { id: '10', label: 'Paleto Bay', role: 'Outlier', neighbors: ['5'] },
    '11': { id: '11', label: 'Grapeseed', role: 'Outlier', neighbors: ['6'] },
    '12': { id: '12', label: 'Chumash', role: 'Outlier', neighbors: ['6'] },
};

// Map layout: centre of each district in a 760 x 600 box. Hubs and bridges form
// a diamond in the middle; each outlier sits beside its only neighbour, so no
// two roads cross.
export const MAP_WIDTH = 760;
export const MAP_HEIGHT = 600;
export const NODE_POSITIONS: Record<NodeId, { x: number, y: number }> = {
    '9': { x: 380, y: 55 },
    '7': { x: 70, y: 160 }, '4': { x: 380, y: 170 }, '11': { x: 690, y: 160 },
    '3': { x: 140, y: 300 }, '1': { x: 300, y: 300 }, '2': { x: 460, y: 300 }, '6': { x: 620, y: 300 },
    '8': { x: 70, y: 440 }, '5': { x: 380, y: 430 }, '12': { x: 690, y: 440 },
    '10': { x: 380, y: 545 },
};

// District name for a node id; other ids ('SYSTEM', 'POLICE') pass through
export const districtName = (id: string): string => NODES[id as NodeId]?.label ?? id;

// "A", "A and B", "A, B and C"
export const formatDistricts = (ids: NodeId[]): string => {
    const names = ids.map(districtName);
    return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};
