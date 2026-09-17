/******************************************************************************/
/*!
\group  	CtrlAlt
\file		EntityManager.h
\author 	Michael Lazaroo
\par    	m.lazaroo@digipen.edu
\date   	Nov 21, 2024
\brief		Entity Manager

Copyright (C) 2024 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
#ifndef ENTITY_MANAGER_H
#define ENTITY_MANAGER_H

#include "../ECS/ECS.h"
#include "../Components/CTransform.h"
#include "../EntityFactory/EntityFactory.h"

namespace CtrlAltEngine
{

	namespace EntityManagement
	{
		enum EntityType
		{
			ROOT,
			DEFAULT,
			UI,
			DEMO,
			GRID,
			GRIDCELL
		};

		class EntityManager
		{
		private:
			std::vector<ECS::Entity> entityList;
			ECS::Entity rootEntity;
			ECS::Registry* registry;
			EntityFactory::EntityFactory factory;

		public:

			EntityManager(ECS::Registry*);
			ECS::Registry* GetRegistry();

			void CreateRootEntity();
			ECS::Entity GetRootEntity();

			void LoadEntities(int); // Sherman: derelic
			void UnloadEntities();
			ECS::Entity CreateEntity(EntityType);

			void AddEntity();
			void RemoveEntity(ECS::Entity);
			ECS::Entity CloneEntity(ECS::Entity sourceEntity);
			void UpdateWorldTransform(Component::CTransform& transform);
			void AddChild(ECS::Entity parent, ECS::Entity child);
			bool HasParent(ECS::Entity child);
			bool HasChild(ECS::Entity parent, ECS::Entity child);
			ECS::Entity GetParent(ECS::Entity child);
			void SetParent(ECS::Entity child, ECS::Entity parent);  
			void RemoveChild(ECS::Entity parent, ECS::Entity child); 
			void ResetParent(ECS::Entity child);
			void ResetParent(Component::CTransform& childTransform);
			bool SwapEntityHierachyPosition(ECS::Entity entity, bool next);

			std::vector<ECS::Entity>& GetEntityList();
		};
	}
}

#endif // !ENTITY_MANAGER_H

