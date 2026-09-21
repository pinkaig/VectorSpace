/******************************************************************************/
/*!
\group  	CtrlAlt
\file		EntityManager.cpp
\author 	Michael Lazaroo
\par    	m.lazaroo@digipen.edu
\date   	Nov 21, 2024
\brief		Entity Manager

Copyright (C) 2024 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
#include "../src/pch.h"
#include "EntityManager.h"
#include "../PrefabsManager/Prefab.h"
#include "../Application/App.h"

namespace CtrlAltEngine
{
	namespace EntityManagement
	{
		/**
		 * @brief Constructor for the EntityManager class
		 * @param reg Pointer to the ECS registry that will manage the entities
		 */
		EntityManager::EntityManager(ECS::Registry* reg) :
			registry(reg),
			factory(reg) {
		}

		/**
		 * @brief Retrieves the ECS registry associated with this entity manager
		 * @return Pointer to the ECS registry
		 */
		ECS::Registry* EntityManager::GetRegistry()
		{
			return registry;
		}

		/**
		 * @brief Creates the root entity for the entity hierarchy
		 */
		void EntityManager::CreateRootEntity()
		{
			rootEntity = CreateEntity(EntityType::ROOT);
		}

		/**
		 * @brief Retrieves the root entity of the entity hierarchy
		 * @return The root entity
		 */
		ECS::Entity EntityManager::GetRootEntity()
		{
			return rootEntity;
		}

		/**
		 * @brief Loads a specified number of default entities
		 * @param n The number of entities to load
		 */
		void EntityManager::LoadEntities(int n)
		{
			for (int i = 0; i < n; i++)
				CreateEntity(EntityType::DEFAULT);
		}

		/**
		 * @brief Unloads and removes all entities from the registry and entity list
		 */
		void EntityManager::UnloadEntities()
		{
			registry->ClearEntities();
			entityList.clear();
		}

		/**
		 * @brief Creates a new entity of the specified type
		 * @param type The type of entity to create
		 * @return The newly created entity
		 */
		ECS::Entity EntityManager::CreateEntity(EntityType type)
		{
			std::string message;
			ECS::Entity entity;

			switch (type)
			{
			case EntityType::ROOT:
			{
				entity = factory.CreateDefaultEntity();
				message = "Root";
				Logger::LogInfo(message + "Entity created.");
				return entity;
			}

			case EntityType::DEFAULT:
			{
				entity = factory.CreateDefaultEntity();
				message = "Default";
				break;
			}

			case EntityType::UI:
			{
				entity = factory.CreateUIEntity();
				message = "UI";
				break;
			}

			case EntityType::DEMO:
			{
				entity = factory.CreateDemoSprite();
				message = "Demo";
				break;
			}

			case EntityType::GRID:
			{
				entity = factory.CreateGridEntity();
				message = "Grid";
				break;
			}

			case EntityType::GRIDCELL:
			{
				entity = factory.CreateGridCellEntity();
				break;
			}

			default:
				break;
			}

			entityList.push_back(entity);
			std::string name = entity.GetName();
			Logger::LogInfo(message + "Entity created. Entity name: " + name);

			return entity;
		}

		/**
		 * @brief Removes an entity and all its children recursively
		 * @param entity The entity to remove
		 */
		void EntityManager::RemoveEntity(ECS::Entity entity)
		{
			Logger::LogInfo("removing " + entity.GetName());

			auto ent_index = std::find(entityList.begin(), entityList.end(), entity);
			if (ent_index == entityList.end())
			{
				Logger::LogInfo("End of List found instead. Collapsing method");
				return;
			}
			auto& transform = ent_index->GetComponent<Component::CTransform>();

			// Recursively removes all children
			for (auto& child : transform.children)
			{
				RemoveEntity(child);
			}
			transform.children.clear();

			Logger::LogInfo("removed " + entity.GetName());
			entityList.erase(std::remove(ent_index, entityList.end(), *ent_index), entityList.end()); // huh what is this.
			//use registry interface.
			registry->KillEntity(entity); 
			//registry->RemoveEntityFromSystems(entity);
		}

		/**
		 * @brief Gets the list of all entities
		 * @return Reference to the vector containing all entities
		 */
		std::vector<ECS::Entity>& EntityManager::GetEntityList()
		{
			return entityList;
		}

		/**
		 * @brief Placeholder for adding an entity to the entity list
		 * @note Currently empty implementation
		 */
		void EntityManager::AddEntity()
		{
			//entityList.push_back(entity);
		}

		/**
		 * @brief Checks if a parent entity has a specific child entity
		 * @param parent The parent entity to check
		 * @param child The child entity to look for
		 * @return true if the parent has the specified child, false otherwise
		 * @author Michael
		 */
		bool EntityManager::HasChild(ECS::Entity parent, ECS::Entity child) {
			if (!parent.HasComponent<Component::CTransform>())
				return false;

			auto& parentTransform = parent.GetComponent<Component::CTransform>();
			return std::find(parentTransform.children.begin(), parentTransform.children.end(), child)
				!= parentTransform.children.end();
		}

		/**
		 * @brief Adds a child entity to a parent entity's children list
		 * @param parent The parent entity to add the child to
		 * @param child The child entity to be added
		 * @author Michael
		 */
		void EntityManager::AddChild(ECS::Entity parent, ECS::Entity child)
		{
			if (!HasChild(parent, child) && child.HasComponent<Component::CTransform>())
			{
				auto& parentTransform = parent.GetComponent<Component::CTransform>();
				parentTransform.children.push_back(child);
			}
		}

		/**
		 * @brief Checks if an entity has a parent
		 * @param child The entity to check for a parent
		 * @return true if the entity has a parent, false otherwise
		 */
		bool EntityManager::HasParent(ECS::Entity child)
		{
			return child.GetComponent<Component::CTransform>().parent.GetID() > 0;
		}


		/**
		 * @brief Returns the parent's entity
		 * @param child The entity to look for a parent
		 * @return faked created entity of the parent.
		 */
		ECS::Entity EntityManager::GetParent(ECS::Entity child)
		{
			return child.GetComponent<Component::CTransform>().parent; 
		}

		/**
		 * @brief Sets the parent of a child entity
		 * @param child The child entity to set the parent for
		 * @param parent The entity to set as the parent
		 */
		void EntityManager::SetParent(ECS::Entity child, ECS::Entity parent)
		{
			if (!child.HasComponent<Component::CTransform>() ||
				!parent.HasComponent<Component::CTransform>())
				return;

			auto& childTransform = child.GetComponent<Component::CTransform>();
			auto& parentTransform = parent.GetComponent<Component::CTransform>();

			// If child already had a parent, remove it from that parent's children list
			if (childTransform.parent != rootEntity) {
				auto& oldParentTransform = childTransform.parent.GetComponent<Component::CTransform>();
				auto it = std::find(oldParentTransform.children.begin(),
					oldParentTransform.children.end(), child);
				if (it != oldParentTransform.children.end()) {
					oldParentTransform.children.erase(it);
				}
			}

			// Set new parent
			childTransform.parent = parent;
			parentTransform.children.push_back(child);
		}

		/**
		 * @brief Removes a child entity from a parent entity's children list
		 * @param parent The parent entity to remove the child from
		 * @param child The child entity to remove
		 */
		void EntityManager::RemoveChild(ECS::Entity parent, ECS::Entity child)
		{
			if (HasChild(parent, child)) {
				auto& parentTransform = parent.GetComponent<Component::CTransform>();
				parentTransform.children.erase(std::remove(parentTransform.children.begin(),
					parentTransform.children.end(), child), parentTransform.children.end());
				ResetParent(child);
			}
		}

		/**
		 * @brief Resets an entity's parent to the root entity
		 * @param child The entity whose parent should be reset
		 */
		void EntityManager::ResetParent(ECS::Entity child)
		{
			child.GetComponent<Component::CTransform>().parent = rootEntity;
		}

		/**
		 * @brief Resets a transform component's parent to the root entity
		 * @param childTransform The transform component to reset
		 */
		void EntityManager::ResetParent(Component::CTransform& childTransform)
		{
			childTransform.parent = rootEntity;
		}

		/**
		 * @brief Swaps an entity's position in the hierarchy with the next or previous entity
		 * @param entity The entity to swap position
		 * @param next If true, swap with next entity; if false, swap with previous entity
		 * @return true if the swap was successful, false if at boundary of list
		 */
		bool EntityManager::SwapEntityHierachyPosition(ECS::Entity entity, bool next)
		{
			auto it = std::find(std::begin(entityList), std::end(entityList), entity);
			Logger::LogInfo(it->GetName());

			if (it == entityList.begin() && !next)
				return false;

			if (it == entityList.end() - 1 && next)
				return false;

			auto it_to_swap = it + (size_t)(next ? 1 : -1);

			std::swap(*it, *it_to_swap);
			for (auto const& system : registry->GetSystems())
				system.second->SwapEntitiesPosition(*it, *it_to_swap);
			return true;
		}

		/**
		 * @brief Creates a clone of an existing entity
		 * @param sourceEntity The entity to clone
		 * @return The newly created clone entity
		 */
		ECS::Entity EntityManager::CloneEntity(ECS::Entity sourceEntity)
		{
			ECS::Entity clone = CreateEntity(EntityType::DEFAULT);
			const auto& sourceComponentMask = registry->entityComponentMasks[sourceEntity.GetID()];
			for (size_t i = 0; i < sourceComponentMask.size(); ++i)
			{
				if (sourceComponentMask.test(i))
				{
					auto pool = registry->componentPools[i];
					if (!pool) continue;
					if (!registry->entityComponentMasks[clone.GetID()].test(i)) {
						registry->entityComponentMasks[clone.GetID()].set(i);
						pool->RemoveEntityFromPool(clone.GetID());
					}
					pool->CopyComponent(sourceEntity.GetID(), clone.GetID());
				}
			}
			std::string sourceName = sourceEntity.GetName();
			if (!sourceName.empty())
				clone.SetName(sourceName + " Clone");

			registry->AddEntityToSystems(clone);
			return clone;
		}
	}
}