export type Todo = { id: string; text: string; done: boolean; anchorId?: string };
export type CustomField = { id: string; title: string; value: string };

export type Category = { id: string; name: string; icon: string };
export type Entity = { id: string; categoryId: string; name: string; avatar: string; desc: string; fields: CustomField[] };
export type Relation = { id: string; sourceId: string; targetId: string; type?: string };

export type Snapshot = {
  id: string; parentId: string | null; label: string; branch: string; timestamp: number;
  data: { 
    title: string; content: any; 
    categories: Category[]; entities: Entity[]; 
    relations: Relation[]; todos: Todo[] 
  };
};