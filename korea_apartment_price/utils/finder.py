from typing import Any, Dict, List, Optional, Set, Union
import jamo

# The trie implementation came from
# https://m.blog.naver.com/cjsencks/221740232900
class Node(object):
    def __init__(self, key:str, full_path:Optional[List[str]]=None, data:Any=None):
        self.key:str = key
        self.full_path: Optional[List[str]] = full_path
        self.children: Dict[str, Node] = {}
        self.data:Any = data

class Trie(object):
    def __init__(self):
        self.head: Node = Node(None)

    def insert(self, path: List[str], data:Any=None):
        current_node = self.head

        for char in path:
            if char not in current_node.children:
                current_node.children[char] = Node(char)
            current_node = current_node.children[char]
        current_node.full_path = path
        current_node.data = data

    def search(self, path: List[str])->Optional[Node]:
        current_node = self.head

        for char in path:
            if char in current_node.children:
                current_node = current_node.children[char]
            else:
                return None

        if current_node.full_path:
            return current_node
        else:
            return None

    def starts_with(self, prefix: List[str])->List[Node]:
        current_node = self.head
        result_nodes = []

        for p in prefix:
            if p in current_node.children:
                current_node = current_node.children[p]
            else:
                return result_nodes 

        current_node = [current_node]
        next_node = []
        while True:
            for node in current_node:
                if node.full_path:
                    result_nodes.append(node)
                next_node.extend(list(node.children.values()))
            if len(next_node) != 0:
                current_node = next_node
                next_node = []
            else:
                break
        return result_nodes

class Finder(object):
  def __init__(self):
    self.trie = Trie()
    self.reverse_trie = Trie()
    self.tag2ids: Dict[str, Set[int]] = dict()
    self.id2data: Dict[int, Any] = dict()
  
  def register(self, tags:List[str], data:Any):
    cur_data_id = len(self.id2data)
    self.id2data[cur_data_id] = data

    for tag in tags:
      tag = tag.strip()

      if not tag in self.tag2ids:
        self.tag2ids[tag] = set()
      self.tag2ids[tag].add(cur_data_id)

      tag_path = list(jamo.jamo_to_hcj(jamo.hangul_to_jamo(tag)))
      tag_chosung_path = list(jamo.jamo_to_hcj([ch for ch in jamo.hangul_to_jamo(tag) if ch in jamo.JAMO_LEADS]))

      for cur_tag_path, cur_tag in [(tag_path, tag), (tag_chosung_path, tag)]:
        node = self.trie.search(cur_tag_path)
        if node is not None: node.data.append(cur_tag)
        else: self.trie.insert(cur_tag_path, [cur_tag])

      for cur_tag_path, cur_tag in [(reversed(tag_path), tag), (reversed(tag_chosung_path), tag)]:
        node = self.reverse_trie.search(cur_tag_path)
        if node is not None: node.data.append(cur_tag)
        else: self.reverse_trie.insert(cur_tag_path, [cur_tag])


  def search(self, queries:Union[List[str], str])->List[Any]:
    ids = set()

    if isinstance(queries, str):
      queries = queries.strip().split()
    queries = [e.strip() for e in queries if len(e.strip()) > 0]

    for query in queries:
      query = query.strip()
      tag_path = list(jamo.jamo_to_hcj(jamo.hangul_to_jamo(query)))
      tag_chosung_path = list(jamo.jamo_to_hcj([ch for ch in jamo.hangul_to_jamo(query) if ch in jamo.JAMO_LEADS]))

      current_related_tags = set()

      if len(tag_chosung_path) == len(tag_path):
        for node in self.trie.starts_with(tag_chosung_path):
          current_related_tags.update(node.data)

        for node in self.reverse_trie.starts_with(reversed(tag_chosung_path)):
          current_related_tags.update(node.data)
      else:
        for node in self.trie.starts_with(tag_path):
          current_related_tags.update(node.data)

        for node in self.reverse_trie.starts_with(reversed(tag_path)):
          current_related_tags.update(node.data)

      current_ids = set()
      for tag in current_related_tags:
        if tag in self.tag2ids:
          current_ids.update(self.tag2ids[tag])
      
      if len(ids) == 0:
        ids = current_ids
      else:
        ids.intersection_update(current_ids)
    
    res = []
    for id in ids:
      res.append(self.id2data[id])
    
    return res