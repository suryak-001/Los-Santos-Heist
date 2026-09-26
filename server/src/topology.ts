export type NodeId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export interface NodeDef {
    id: NodeId;
    label: string;
    neighbors: NodeId[];
    role: 'Hub' | 'Bridge' | 'Outlier';
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
